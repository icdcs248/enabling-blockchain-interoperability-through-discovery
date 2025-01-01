#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
pub mod weights;

pub use weights::*;

#[frame_support::pallet]
pub mod pallet {

	use super::*;
	use codec::Encode;
	use core::str;
	use frame_support::{pallet_prelude::*, Deserialize, Serialize};
	use frame_system::{
		offchain::{CreateSignedTransaction, SubmitTransaction},
		pallet_prelude::{BlockNumberFor, *},
	};
	use scale_info::prelude::{boxed::Box, format, string::String, vec, vec::Vec};
	use sp_core::{offchain::Duration, U256};
	use sp_runtime::offchain::http;

	#[pallet::pallet]
	#[pallet::without_storage_info]
	pub struct Pallet<T>(_);

	#[pallet::config]
	pub trait Config: CreateSignedTransaction<Call<Self>> + frame_system::Config {
		/// The overarching runtime event type.
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
		/// A type representing the weights required by the dispatchables of this pallet.
		type WeightInfo: WeightInfo;
		type PalletRootDNS: pallet_rootdns::Config;
	}

	const TLD_MODULE_PREFIX: &[u8] = b"TldModule";
	const TLD_STORAGE_PREFIX: &[u8] = b"DomainMap";
	const DOMAIN_BATCH_SIZE: usize = 10;
	const REQUEST_LIFETIME: u32 = 1000;

	#[derive(Encode, Decode, Clone, PartialEq, Default, TypeInfo)]
	pub struct ProviderList {
		pub providers: Vec<Vec<u8>>,
	}

	#[derive(Encode, Decode, Clone, PartialEq, Default, TypeInfo)]
	pub struct AssetList {
		pub assets: Vec<Vec<u8>>,
	}

	#[derive(Encode, Decode, Clone, PartialEq, Default, TypeInfo, Debug)]
	pub struct PendingRequest {
		pub requester: Vec<u8>,
		pub domain: Vec<u8>,
		pub asset_hash: Vec<u8>,
		pub timestamp: U256,
	}

	#[pallet::storage]
	#[pallet::getter(fn asset_providers)]
	pub(super) type AssetProviders<T: Config> =
		StorageMap<_, Blake2_128Concat, Vec<u8>, ProviderList, OptionQuery>;

	#[pallet::storage]
	#[pallet::getter(fn provider_assets)]
	pub(super) type ProviderAssets<T: Config> =
		StorageMap<_, Blake2_128Concat, Vec<u8>, AssetList, OptionQuery>;

	#[pallet::storage]
	#[pallet::getter(fn last_processed_domain)]
	pub(super) type LastProcessedDomain<T: Config> = StorageValue<_, Vec<u8>, ValueQuery>;

	#[pallet::storage]
	#[pallet::getter(fn pending_requests)]
	pub(super) type PendingRequests<T: Config> =
		StorageMap<_, Blake2_128Concat, Vec<u8>, PendingRequest, OptionQuery>;

	#[pallet::event]
	#[pallet::generate_deposit(pub (super) fn deposit_event)]
	pub enum Event<T: Config> {
		DomainValidationRequested(T::AccountId, PendingRequest),
		AssetRegisteredForDomain(Vec<u8>, Vec<u8>, U256),
		AssetProviderRevoked(Vec<u8>),
		TesterEvent(Vec<(T::AccountId, PendingRequest)>),
		ExpiredRequestsRemoved,
	}

	#[pallet::error]
	pub enum Error<T> {
		DomainInvalid,
		RequestFailed,
		RequestDoesNotExist,
	}

	fn extract_tld(domain: &[u8]) -> Option<&[u8]> {
		if let Some(pos) = domain.iter().rposition(|&b| b == b'.') {
			Some(&domain[pos + 1..])
		} else {
			None
		}
	}

	#[derive(Debug, Deserialize)]
	struct Chainspec {
		#[serde(rename = "bootNodes")]
		boot_nodes: Vec<String>,
	}

	fn fetch_json_from_url(url: &str) -> Result<Chainspec, &'static str> {
		let request = http::Request::get(url);

		let response = match request.send() {
			Ok(resp) => {
				let deadline = sp_io::offchain::timestamp().add(Duration::from_millis(5000));
				match resp.try_wait(deadline) {
					Ok(response) => match response {
						Ok(r) => r,
						Err(_) => {
							log::error!("Failed to get response");
							return Err("Failed to get response");
						},
					},
					Err(_) => {
						log::error!("Failed to wait for response");
						return Err("Failed to wait for response");
					},
				}
			},
			Err(_) => {
				log::error!("Failed to send HTTP request");
				return Err("Failed to send HTTP request");
			},
		};

		if response.code != 200 {
			return Err("Unexpected response code");
		}

		let mut body = Vec::new();
		response.body().for_each(|chunk| body.push(chunk));

		let body_str = str::from_utf8(&body).map_err(|_| "Invalid UTF-8")?;
		let chainspec: Chainspec =
			serde_json::from_str(body_str).map_err(|_| "Failed to parse JSON")?;

		Ok(chainspec)
	}

	fn blake2_128_concat(input: Vec<u8>) -> Vec<u8> {
		let hash = sp_core::hashing::blake2_128(input.as_slice());
		let mut result = Vec::with_capacity(hash.len() + input.len());
		result.extend_from_slice(&hash);
		result.extend(input);
		result
	}

	fn extract_rpc_endpoint(multiaddr: String) -> String {
		let parts: Vec<&str> = multiaddr.split('/').collect();
		let ip = if parts.len() > 2 { parts[2] } else { "" };
		let port = if parts.len() > 4 { parts[4] } else { "" };
		format!("http://{}:{}", ip, port)
	}

	#[derive(Serialize, Deserialize, Debug)]
	struct RPCResponse {
		jsonrpc: String,
		result: String,
		id: u32,
	}

	#[pallet::validate_unsigned]
	impl<T: Config> ValidateUnsigned for Pallet<T> {
		type Call = Call<T>;

		fn validate_unsigned(source: TransactionSource, call: &Self::Call) -> TransactionValidity {
			// match source {
			// 	TransactionSource::Local | TransactionSource::External => {
			// Allow unsigned transactions only from the Offchain worker.
			if let Call::submit_verified_domain { account_id, pending_request } = call {
				let tag =
					(pending_request.domain.clone(), pending_request.asset_hash.clone()).encode();
				return ValidTransaction::with_tag_prefix("offchain_worker")
					.priority(TransactionPriority::MAX) // Highest priority
					.longevity(1)
					.propagate(true)
					.build();
			}

			if let Call::remove_expired_pending_requests { .. } = call {
				return ValidTransaction::with_tag_prefix("offchain_worker_expired_requests")
					.priority(TransactionPriority::MAX) // Highest priority
					.longevity(1)
					.propagate(true)
					.build();
			}

			if let Call::cleanup_revoked_domains { .. } = call {
				return ValidTransaction::with_tag_prefix("offchain_worker_cleanup_revoked")
					.priority(TransactionPriority::MAX) // Highest priority
					.longevity(1)
					.propagate(true)
					.build();
			}

			// },
			// // Reject if not from an offchain worker
			// _ => return InvalidTransaction::Call.into(),
			// }

			InvalidTransaction::Call.into()
		}
	}

	impl<T: Config> Pallet<T> {
		fn fetch_pending_requests(
			batch_size: usize,
			current_time: U256,
		) -> Vec<(Vec<u8>, PendingRequest)> {
			PendingRequests::<T>::iter()
				.filter_map(|(account, data)| {
					if current_time <= data.timestamp {
						Some((
							account,
							PendingRequest {
								requester: data.requester,
								domain: data.domain,
								asset_hash: data.asset_hash,
								timestamp: data.timestamp,
							},
						))
					} else {
						None
					}
				})
				.take(batch_size)
				.collect()
		}

		fn query_tld_network(domain: Vec<u8>) -> bool {
			let tld = match extract_tld(&domain) {
				Some(tld) => tld,
				None => return false,
			};

			let tld_info =
				match pallet_rootdns::Pallet::<T::PalletRootDNS>::get_chainspec_for_tld(tld) {
					Some(tld_info) => tld_info,
					None => return false,
				};

			let spec = match fetch_json_from_url(str::from_utf8(&tld_info.chain_spec).unwrap()) {
				Ok(chainspec) => chainspec,
				Err(_) => return false,
			};

			if spec.boot_nodes.is_empty() {
				log::error!("No boot nodes found in chainspec");
				return false;
			}

			let multiaddr = spec.boot_nodes[0].clone(); // TODO: just take the first bootnode for now
			let rpc_endpoint = extract_rpc_endpoint(multiaddr);
			// Storage key calculation
			let mut storage_key = vec![];
			storage_key.extend(sp_core::hashing::twox_128(TLD_MODULE_PREFIX));
			storage_key.extend(sp_core::hashing::twox_128(TLD_STORAGE_PREFIX));
			storage_key.extend(blake2_128_concat(domain.clone().encode()));

			let key_hex = hex::encode(storage_key);

			const REQUEST_BODY: &str = r#"
            {
                "id":1,
                "jsonrpc":"2.0",
                "method": "state_getStorage",
				"params": ["{}"]
            }"#;

			let request_body = REQUEST_BODY.replace("{}", &key_hex);

			let req = http::Request::post(&rpc_endpoint, vec![request_body])
				.add_header("content-type", "application/json")
				.send()
				.unwrap();

			let res = match req.wait() {
				Ok(res) => res,
				Err(err) => {
					log::info!("Error sending request: {:?}", err);
					return false;
				},
			};

			if res.code == 200 {
				let body = res.body().collect::<Vec<_>>();
				let body_str = String::from_utf8(body).unwrap();

				let decoded_body = serde_json::from_str::<RPCResponse>(&body_str).unwrap();
				let result_bytes =
					hex::decode(decoded_body.result.trim_start_matches("0x")).unwrap();

				let domain_info =
					pallet_tld::DomainInfo::<T::AccountId>::decode(&mut &result_bytes[..])
						.expect("Failed to decode domain information");
				return !domain_info.available;
			} else {
				log::info!("Request failed with code: {}", res.code);
			}
			false
		}

		fn submit_domain_verification(account_id: Vec<u8>, pending_request: PendingRequest) {
			let call = Call::submit_verified_domain { account_id, pending_request };
			SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into())
				.expect("Failed to submit unsigned transaction");
		}

		fn cleanup_expired_requests(current_time: U256) {
			if current_time % 10 == 0.into() {
				log::info!("Cleaning up expired requests");
				let call = Call::remove_expired_pending_requests { current_time };
				SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into())
					.expect("Failed to submit unsigned transaction");
			}
		}

		fn get_domain_batch(batch_size: usize) -> Result<Vec<Vec<u8>>, &'static str> {
			let mut keys = Vec::new();
			let mut key_count = 0;
			let last_key = LastProcessedDomain::<T>::get();

			let iter = match last_key.is_empty() {
				true => ProviderAssets::<T>::iter(),
				false => ProviderAssets::<T>::iter_from(last_key),
			};

			for (key, _value) in iter {
				if key_count >= batch_size {
					break;
				}
				keys.push(key);
				key_count += 1;
			}

			if let Some(last_key) = keys.last() {
				LastProcessedDomain::<T>::put(last_key);
			}

			Ok(keys)
		}

		fn remove_revoked_domains(domain_batch: Vec<Vec<u8>>) {
			let mut revoked_domains = Vec::new();

			for domain in domain_batch {
				let is_valid = Self::query_tld_network(domain.clone());
				if !is_valid {
					revoked_domains.push(domain.clone());
				}
			}

			if revoked_domains.is_empty() {
				return;
			}

			let call = Call::cleanup_revoked_domains { domains: revoked_domains };
			SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into())
				.expect("Failed to submit unsigned transaction");
		}
	}

	#[pallet::hooks]
	impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
		fn offchain_worker(block_number: BlockNumberFor<T>) {
			let current_time = block_number.into();
			if current_time % 10 == 0.into() {
				Self::remove_revoked_domains(Self::get_domain_batch(DOMAIN_BATCH_SIZE).unwrap())
			}

			Self::cleanup_expired_requests(current_time);

			let batch_size = 10;
			let pending_requests = Self::fetch_pending_requests(batch_size, current_time);

			for request in pending_requests {
				let domain = request.1.domain.clone();

				let domain_valid = Self::query_tld_network(domain.clone());

				if domain_valid {
					let _ = Self::submit_domain_verification(request.0, request.1);
				}
			}
		}
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		#[pallet::call_index(0)]
		#[pallet::weight(10_000 + T::DbWeight::get().writes(1).ref_time())]
		pub fn submit_verified_domain(
			origin: OriginFor<T>,
			account_id: Vec<u8>,
			pending_request: PendingRequest,
		) -> DispatchResult {
			// Only allow off-chain workers to call this function
			ensure_none(origin)?;

			let current_block_number = <frame_system::Pallet<T>>::block_number();

			let mut key = vec![];
			key.append(&mut pending_request.asset_hash.clone());
			key.append(&mut pending_request.domain.clone());

			let request_exists = <PendingRequests<T>>::contains_key(key);

			if !request_exists {
				return Err(Error::<T>::RequestDoesNotExist.into());
			}

			PendingRequests::<T>::remove(account_id);

			match AssetProviders::<T>::get(&pending_request.asset_hash) {
				Some(provider_list) => {
					let mut providers = provider_list.providers.clone();
					providers.push(pending_request.domain.clone());
					AssetProviders::<T>::insert(
						pending_request.asset_hash.clone(),
						ProviderList { providers },
					);
				},
				None => {
					AssetProviders::<T>::insert(
						pending_request.asset_hash.clone(),
						ProviderList { providers: vec![pending_request.domain.clone()] },
					);
				},
			}

			match ProviderAssets::<T>::get(&pending_request.domain) {
				Some(asset_list) => {
					let mut assets = asset_list.assets.clone();
					assets.push(pending_request.asset_hash.clone());
					ProviderAssets::<T>::insert(
						pending_request.domain.clone(),
						AssetList { assets },
					);
				},
				None => {
					ProviderAssets::<T>::insert(
						pending_request.domain.clone(),
						AssetList { assets: vec![pending_request.asset_hash.clone()] },
					);
				},
			}

			Self::deposit_event(Event::AssetRegisteredForDomain(
				pending_request.asset_hash,
				pending_request.domain,
				current_block_number.into(),
			));

			Ok(())
		}

		#[pallet::call_index(1)]
		#[pallet::weight(10_000 + T::DbWeight::get().writes(1).ref_time())]
		pub fn register_asset_for_domain(
			origin: OriginFor<T>,
			domain: Vec<u8>,
			asset_hash: Vec<u8>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			let current_block_number = <frame_system::Pallet<T>>::block_number();
			let lifetime = current_block_number.into() + REQUEST_LIFETIME;

			let request = PendingRequest {
				requester: who.clone().encode(),
				domain: domain.clone(),
				asset_hash: asset_hash.clone(),
				timestamp: lifetime,
			};

			let mut key = vec![];
			key.append(&mut asset_hash.clone());
			key.append(&mut domain.clone());

			// Request ocw to validate domain
			PendingRequests::<T>::insert(key, request.clone());

			// Emit event
			Self::deposit_event(Event::DomainValidationRequested(who, request));

			Ok(())
		}

		#[pallet::call_index(2)]
		#[pallet::weight(10_000 + T::DbWeight::get().writes(1).ref_time())]
		pub fn cleanup_revoked_domains(
			origin: OriginFor<T>,
			domains: Vec<Vec<u8>>,
		) -> DispatchResult {
			// Only allow off-chain workers to call this function
			ensure_none(origin)?;

			for domain in domains {
				let asset_list = ProviderAssets::<T>::get(&domain).unwrap();
				for asset in asset_list.assets {
					let provider_list = AssetProviders::<T>::get(&asset).unwrap();
					let new_providers =
						provider_list.providers.iter().filter(|&x| x != &domain).cloned().collect();
					AssetProviders::<T>::insert(
						asset.clone(),
						ProviderList { providers: new_providers },
					);
				}
				ProviderAssets::<T>::remove(&domain);
				Self::deposit_event(Event::AssetProviderRevoked(domain));
			}

			Ok(())
		}

		#[pallet::call_index(3)]
		#[pallet::weight(10_000 + T::DbWeight::get().writes(1).ref_time())]
		pub fn remove_expired_pending_requests(
			origin: OriginFor<T>,
			current_time: U256,
		) -> DispatchResult {
			// // Only allow off-chain workers to call this function
			ensure_none(origin)?;

			let current_block_number = <frame_system::Pallet<T>>::block_number();

			for (account, data) in PendingRequests::<T>::iter() {
				if current_block_number.into() < data.timestamp {
					continue;
				}
				PendingRequests::<T>::remove(account);
			}

			Self::deposit_event(Event::ExpiredRequestsRemoved);

			Ok(())
		}
	}
}
