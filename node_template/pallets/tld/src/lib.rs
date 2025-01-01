//! # Template Pallet
//!
//! A pallet with minimal functionality to help developers understand the essential components of
//! writing a FRAME pallet. It is typically used in beginner tutorials or in Substrate template
//! nodes as a starting point for creating a new pallet and **not meant to be used in production**.
//!
//! ## Overview
//!
//! This template pallet contains basic examples of:
//! - declaring a storage item that stores a single `u32` value
//! - declaring and using events
//! - declaring and using errors
//! - a dispatchable function that allows a user to set a new value to storage and emits an event
//!   upon success
//! - another dispatchable function that causes a custom error to be thrown
//!
//! Each pallet section is annotated with an attribute using the `#[pallet::...]` procedural macro.
//! This macro generates the necessary code for a pallet to be aggregated into a FRAME runtime.
//!
//! Learn more about FRAME macros [here](https://docs.substrate.io/reference/frame-macros/).
//!
//! ### Pallet Sections
//!
//! The pallet sections in this template are:
//!
//! - A **configuration trait** that defines the types and parameters which the pallet depends on
//!   (denoted by the `#[pallet::config]` attribute). See: [`Config`].
//! - A **means to store pallet-specific data** (denoted by the `#[pallet::storage]` attribute).
//!   See: [`storage_types`].
//! - A **declaration of the events** this pallet emits (denoted by the `#[pallet::event]`
//!   attribute). See: [`Event`].
//! - A **declaration of the errors** that this pallet can throw (denoted by the `#[pallet::error]`
//!   attribute). See: [`Error`].
//! - A **set of dispatchable functions** that define the pallet's functionality (denoted by the
//!   `#[pallet::call]` attribute). See: [`dispatchables`].
//!
//! Run `cargo doc --package pallet-template --open` to view this pallet's documentation.

// We make sure this pallet uses `no_std` for compiling to Wasm.
#![cfg_attr(not(feature = "std"), no_std)]

// Re-export pallet items so that they can be accessed from the crate namespace.
pub use pallet::*;

// FRAME pallets require their own "mock runtimes" to be able to run unit tests. This module
// contains a mock runtime specific for testing this pallet's functionality.
#[cfg(test)]
mod mock;

// This module contains the unit tests for this pallet.
// Learn about pallet unit testing here: https://docs.substrate.io/test/unit-testing/
#[cfg(test)]
mod tests;

// Every callable function or "dispatchable" a pallet exposes must have weight values that correctly
// estimate a dispatchable's execution time. The benchmarking module is used to calculate weights
// for each dispatchable and generates this pallet's weight.rs file. Learn more about benchmarking here: https://docs.substrate.io/test/benchmark/
#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
pub mod weights;

pub use weights::*;

pub mod crypto;

// All pallet logic is defined in its own module and must be annotated by the `pallet` attribute.
#[frame_support::pallet]
pub mod pallet {

	// Import various useful types required by all FRAME pallets.
	use super::*;
	use frame_support::{
		pallet_prelude::*,
		sp_runtime::offchain::{http, storage::StorageValueRef, KeyTypeId},
		Deserialize, Serialize,
	};
	use frame_system::{
		offchain::{AppCrypto, CreateSignedTransaction, SendSignedTransaction, Signer},
		pallet_prelude::*,
	};
	use scale_info::prelude::{string::String, vec, vec::Vec};

	// The `Pallet` struct serves as a placeholder to implement traits, methods and dispatchables
	// (`Call`s) in this pallet.
	#[pallet::pallet]
	#[pallet::without_storage_info]
	pub struct Pallet<T>(_);

	/// The pallet's configuration trait.
	///
	/// All our types and constants a pallet depends on must be declared here.
	/// These types are defined generically and made concrete when the pallet is declared in the
	/// `runtime/src/lib.rs` file of your chain.
	#[pallet::config]
	pub trait Config: CreateSignedTransaction<Call<Self>> + frame_system::Config {
		/// The overarching runtime event type.
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
		/// A type representing the weights required by the dispatchables of this pallet.
		type WeightInfo: WeightInfo;
		type AuthorityId: AppCrypto<Self::Public, Self::Signature>;
	}

	pub const KEY_TYPE: KeyTypeId = KeyTypeId(*b"bcdn");

	#[derive(Debug, Encode, Decode, Clone, PartialEq, Default, TypeInfo)]
	pub struct DomainInfo<AccountId> {
		pub creator: AccountId,
		// A link pointing to the TLD network chain specification
		pub chain_spec: Vec<u8>,
		// Maintainer node provided by the network claiming this domain
		pub maintainer: Vec<u8>,
		// Boolean signifying the availability of the domain name
		pub available: bool,
	}

	impl<AccountId> DomainInfo<AccountId> {
		pub fn new(
			creator: AccountId,
			chain_spec: Vec<u8>,
			maintainer: Vec<u8>,
			available: bool,
		) -> Self {
			Self { creator, chain_spec, maintainer, available }
		}
	}

	/// A storage item for this pallet.
	///
	/// In this template, we are declaring a storage item called `Something` that stores a single
	/// `u32` value. Learn more about runtime storage here: <https://docs.substrate.io/build/runtime-storage/>
	#[pallet::storage]
	#[pallet::getter(fn domain_map)]
	pub(super) type DomainMap<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		// The domain name of the network
		Vec<u8>,
		DomainInfo<T::AccountId>,
		OptionQuery,
	>;

	#[pallet::storage]
	#[pallet::getter(fn maintainer_map)]
	pub(super) type MaintainerMap<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		// Maintainer ID
		Vec<u8>,
		// Domain name
		Vec<u8>,
		OptionQuery,
	>;

	/// Events that functions in this pallet can emit.
	///
	/// Events are a simple means of indicating to the outside world (such as dApps, chain explorers
	/// or other users) that some notable update in the runtime has occurred. In a FRAME pallet, the
	/// documentation for each event field and its parameters is added to a node's metadata so it
	/// can be used by external interfaces or tools.
	///
	///    The `generate_deposit` macro generates a function on `Pallet` called `deposit_event`
	/// which will convert the event type of your pallet into `RuntimeEvent` (declared in the
	/// pallet's [`Config`] trait) and deposit it using [`frame_system::Pallet::deposit_event`].
	#[pallet::event]
	#[pallet::generate_deposit(pub (super) fn deposit_event)]
	pub enum Event<T: Config> {
		DomainRegistered { domain_name: Vec<u8>, creator: T::AccountId },
		DomainAmended { domain_name: Vec<u8>, editor: T::AccountId },
		DomainRevoked { domain_name: Vec<u8>, revoker: T::AccountId },
	}

	/// Errors that can be returned by this pallet.
	///
	/// Errors tell users that something went wrong so it's important that their naming is
	/// informative. Similar to events, error documentation is added to a node's metadata so it's
	/// equally important that they have helpful documentation associated with them.
	///
	/// This type of runtime error can be up to 4 bytes in size should you want to return additional
	/// information.
	#[pallet::error]
	pub enum Error<T> {
		/// The value retrieved was `None` as no value was previously set.
		NoneValue,
		/// There was an attempt to increment the value in storage over `u32::MAX`.
		StorageOverflow,
		/// The domain was already registered by someone else.
		DomainNotAvailable,
		/// Non-owner node tried changing domain information
		InvalidOwnerId,
		/// Requested domain was not found
		DomainNotFound,
	}

	#[derive(Serialize, Deserialize, Debug)]
	struct RPCResponse {
		jsonrpc: String,
		result: Vec<PeerInfo>,
		id: u32,
	}

	#[derive(Serialize, Deserialize, Debug)]
	#[serde(rename_all = "snake_case")]
	struct PeerInfo {
		#[serde(rename = "peerId")]
		peer_id: String,
		roles: String,
		#[serde(rename = "bestHash")]
		best_hash: String,
		#[serde(rename = "bestNumber")]
		best_number: u64,
	}

	#[derive(Encode, Decode, Default)]
	struct PeerCache {
		peers: Vec<Vec<u8>>, // Would be better to use a HashSet but no_std doesn't support it
	}

	impl PeerCache {
		fn new() -> Self {
			PeerCache { peers: Vec::new() }
		}

		fn add(&mut self, peer_id: Vec<u8>) {
			self.peers.push(peer_id);
		}

		fn remove(&mut self, peer_id: Vec<u8>) {
			self.peers
				.iter()
				.position(|e| e == &peer_id)
				.map(|index| self.peers.remove(index));
		}

		fn contains(&mut self, peer_id: Vec<u8>) -> bool {
			self.peers.contains(&peer_id)
		}
	}

	// Local storage key for peer cache
	const PEER_CACHE_STORAGE_KEY: &[u8] = b"peer_cache_worker::cache";

	#[pallet::hooks]
	impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
		fn offchain_worker(_block_number: BlockNumberFor<T>) {
			let storage_ref = StorageValueRef::persistent(PEER_CACHE_STORAGE_KEY);
			let data = storage_ref.get::<PeerCache>();
			let mut cache = match data {
				Ok(Some(data)) => data,
				_ => PeerCache::new(),
			};

			let mut cache_peers: Vec<Vec<u8>> = Vec::new();

			for peer in cache.peers.iter() {
				cache_peers.push(peer.clone());
			}

			// Constants
			const REQUEST_BODY: &str = r#"
            {
                "id":1,
                "jsonrpc":"2.0",
                "method": "system_peers"
            }"#;

			const ENDPOINT: &str = "http://127.0.0.1:9945";

			// Send an HTTP request to the RPC endpoint
			let req = http::Request::post(ENDPOINT, vec![REQUEST_BODY])
				.add_header("content-type", "application/json")
				.send()
				.unwrap();

			let res = match req.wait() {
				Ok(res) => res,
				Err(err) => {
					log::error!("Error sending request: {:?}", err);
					return;
				},
			};

			if res.code == 200 {
				// Request is successful
				let body = res.body().collect::<Vec<_>>();
				let body_str = String::from_utf8(body).unwrap();
				let decoded_body = serde_json::from_str::<RPCResponse>(&body_str).unwrap();

				for peer in decoded_body.result {
					log::info!("Peer ID: {}", peer.peer_id);
					let peer_id = peer.peer_id.as_bytes().to_vec();
					if !cache.contains(peer_id.clone()) {
						cache.add(peer_id);
					} else {
						cache_peers
							.iter()
							.position(|e| e == &peer_id)
							.map(|index| cache_peers.remove(index));
					}
				}

				// Removing peers that are no longer in the network and disabling their associated
				// domains
				for peer in cache_peers.iter() {
					cache.remove(peer.clone());

					// Get domain associated with node if exists
					let domain_name = match Self::maintainer_map(peer) {
						Some(domain) => domain,
						None => continue,
					};

					let call = Call::revoke_domain { domain_name: domain_name.into() };

					let signer = Signer::<T, T::AuthorityId>::all_accounts();

					let results = signer.send_signed_transaction(|_account| call.clone());

					for (acc, res) in &results {
						match res {
							Ok(()) => log::info!("[{:?}]: submit transaction success.", acc.id),
							Err(e) => log::error!(
								"[{:?}]: submit transaction failure. Reason: {:?}",
								acc.id,
								e
							),
						}
					}
				}

				storage_ref.set(&cache);
			} else {
				log::info!("Unexpected status code: {}", res.code);
			}
		}
	}

	/// The pallet's dispatchable functions ([`Call`]s).
	///
	/// Dispatchable functions allows users to interact with the pallet and invoke state changes.
	/// These functions materialize as "extrinsics", which are often compared to transactions.
	/// They must always return a `DispatchResult` and be annotated with a weight and call index.
	///
	/// The [`call_index`] macro is used to explicitly
	/// define an index for calls in the [`Call`] enum. This is useful for pallets that may
	/// introduce new dispatchables over time. If the order of a dispatchable changes, its index
	/// will also change which will break backwards compatibility.
	///
	/// The [`weight`] macro is used to assign a weight to each call.
	#[pallet::call]
	impl<T: Config> Pallet<T> {
		#[pallet::call_index(0)]
		#[pallet::weight(10_000 + T::DbWeight::get().writes(1).ref_time())]
		pub fn register_domain(
			origin: OriginFor<T>,
			domain_name: Vec<u8>,
			chain_spec: Vec<u8>,
			maintainer: Vec<u8>,
		) -> DispatchResult {
			// Check that the extrinsic was signed and get the signer.
			let who = ensure_signed(origin)?;

			let domain_exists = <DomainMap<T>>::contains_key(&domain_name);

			if domain_exists && !Self::domain_map(&domain_name).unwrap().available {
				// Return an error if the domain exists and is not available
				return Err(Error::<T>::DomainNotAvailable.into());
			}

			let domain_info = DomainInfo::new(who.clone(), chain_spec, maintainer, false);
			<DomainMap<T>>::insert(&domain_name, &domain_info);
			<MaintainerMap<T>>::insert(&domain_info.maintainer, &domain_name);

			// Emit an event.
			Self::deposit_event(Event::DomainRegistered { domain_name, creator: who });

			// Return a successful `DispatchResult`
			Ok(())
		}

		#[pallet::call_index(1)]
		#[pallet::weight(10_000 + T::DbWeight::get().writes(1).ref_time())]
		pub fn amend_chainspec(
			origin: OriginFor<T>,
			domain_name: Vec<u8>,
			chain_spec: Vec<u8>,
			maintainer: Vec<u8>,
		) -> DispatchResult {
			// Check that the extrinsic was signed and get the signer.
			let who = ensure_signed(origin)?;

			let domain_exists = <DomainMap<T>>::contains_key(&domain_name);

			ensure!(domain_exists, Error::<T>::DomainNotFound);
			ensure!(
				who == Self::domain_map(&domain_name).unwrap().creator,
				Error::<T>::InvalidOwnerId
			);

			let domain_info = DomainInfo::new(who.clone(), chain_spec, maintainer, false);
			<DomainMap<T>>::insert(&domain_name, &domain_info);
			<MaintainerMap<T>>::insert(&domain_info.maintainer, &domain_name);

			// Emit an event.
			Self::deposit_event(Event::DomainAmended { domain_name, editor: who });

			// Return a successful `DispatchResult`
			Ok(())
		}

		#[pallet::call_index(2)]
		#[pallet::weight(10_000 + T::DbWeight::get().writes(1).ref_time())]
		pub fn revoke_domain(origin: OriginFor<T>, domain_name: Vec<u8>) -> DispatchResult {
			// Check that the extrinsic was signed and get the signer.
			let who = ensure_signed(origin)?;

			let domain_exists = <DomainMap<T>>::contains_key(&domain_name);

			ensure!(domain_exists, Error::<T>::DomainNotFound);
			ensure!(
				who == Self::domain_map(&domain_name).unwrap().creator,
				Error::<T>::InvalidOwnerId
			);

			let domain_info = DomainInfo::new(who.clone(), Vec::new(), Vec::new(), true);
			<DomainMap<T>>::insert(&domain_name, domain_info);

			// Emit an event.
			Self::deposit_event(Event::DomainRevoked { domain_name, revoker: who });

			// Return a successful `DispatchResult`
			Ok(())
		}
	}
}
