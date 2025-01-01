use super::KEY_TYPE;
use sp_runtime::{
	app_crypto::{app_crypto, sr25519},
	MultiSignature, MultiSigner,
};
app_crypto!(sr25519, KEY_TYPE);

pub struct TestAuthId;

// implemented for runtime
impl frame_system::offchain::AppCrypto<MultiSigner, MultiSignature> for TestAuthId {
	type RuntimeAppPublic = Public;
	type GenericSignature = sp_core::sr25519::Signature;
	type GenericPublic = sp_core::sr25519::Public;
}
