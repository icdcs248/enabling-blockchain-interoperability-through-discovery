const {getTLD, getTLDSpec, connectToNetwork, getJSONResponse, connector} = require("../util");
const {TxType} = require('../util');
const {createResolver} = require("./resolver");
const {createTransaction} = require("../transaction/transaction");

class Registry {
    constructor(rootNetworkSpecUrl, phrase) {
        this.rootNetworkSpecUrl = rootNetworkSpecUrl;
        this.phrase = phrase;
        this.rootSpec = null
    }

    async init() {
        this.rootSpec = await getJSONResponse(this.rootNetworkSpecUrl);
    }

    async registerAsset(domain, assetId, amount) {
        let resolver = await createResolver(this.rootNetworkSpecUrl);
        await resolver.init();
        let chainSpec = await resolver.resolve(domain);
        let api = await connector.connectToNetwork(await getJSONResponse(chainSpec.targetSpec));
        await createTransaction(TxType.TX_ASSET_CREATE, {
            assetId: assetId,
            minBalance: amount
        }, api, this.phrase).sendTransaction();
    }

    async registerTLD(tld, tldSpec) {
        try {
            let api = await connector.connectToNetwork(this.rootSpec);
            await createTransaction(TxType.TX_ROOT, {
                target: tld,
                targetSpec: tldSpec
            }, api, this.phrase).sendTransaction();
        } catch (error) {
            if (error.toString() === "CONNECTION_ERROR") {
                throw new Error("Could not connect to the root network.");
            } else {
                throw error;
            }
        }
    }

    async registerDomain(domain, domainSpec) {
        try {
            let tld = getTLD(domain);
            let tldSpec = await getTLDSpec(tld, this.rootSpec);
            let api = await connector.connectToNetwork(await getJSONResponse(tldSpec));

            await createTransaction(TxType.TX_TLD, {
                target: domain,
                targetSpec: domainSpec
            }, api, this.phrase).sendTransaction();
        } catch (error) {
            if (error.toString() === "CONNECTION_ERROR") {
                throw new Error("Could not connect to the TLD network.");
            } else {
                throw error;
            }
        }
    }
}

exports
    .createRegistry = (rootSpecAddr, phrase) => {
    return new Registry(rootSpecAddr, phrase);
};
