const {TxType} = require('../util');
const {Keyring} = require("@polkadot/api");

class Transaction {

    constructor(txType, txArgs, api, phrase) {
        this.txType = txType;
        this.txArgs = txArgs;
        this.api = api;
        this.phrase = phrase;
    }

    async sendTransaction() {
        // Init credentials
        const keyring = new Keyring({type: 'sr25519'});
        const account = keyring.addFromUri(this.phrase);
        let tx;

        try {
            switch (this.txType) {
                case TxType.TX_ROOT:
                    let tldName = this.api.createType('Vec<u8>', this.txArgs.target);
                    let tldSpec = this.api.createType('Vec<u8>', this.txArgs.targetSpec);
                    tx = this.api.tx.rootDNSModule.registerTld(tldName, tldSpec);
                    break;
                case TxType.TX_TLD:
                    let domainName = this.api.createType('Vec<u8>', this.txArgs.target);
                    let networkSpec = this.api.createType('Vec<u8>', this.txArgs.targetSpec);
                    let maintainer = this.api.createType('Vec<u8>', "maintainer"); // TODO: hardcoded for now
                    tx = this.api.tx.tldModule.registerDomain(domainName, networkSpec, maintainer);
                    break;
                case TxType.TX_ASSET_CREATE:
                    let assetId = this.api.createType('u32', this.txArgs.assetId);
                    let owner = this.api.createType('MultiAddress', account.address);
                    let minBalance = this.api.createType('u128', this.txArgs.minBalance);
                    tx = this.api.tx.assetsModule.create(assetId, owner, minBalance);
                    break;
                default:
                    throw new Error("Invalid transaction type.");
            }
            await tx.signAndSend(account);
        } catch (error) {
            throw error;
        }
    }
}

exports.createTransaction = (txType, txArgs, api, phrase) => {
    return new Transaction(txType, txArgs, api, phrase);
};