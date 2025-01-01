import {getJSONResponse} from "../util";
import {polkadotConnect} from "../polkadot/connector";
import {Keyring} from '@polkadot/api';
import {TxType} from '../util';

class Registry {
    constructor(rootNetworkSpecUrl) {
        this.rootNetworkSpecUrl = rootNetworkSpecUrl;
        this.rootNodes = []
    }

    async init() {
        this.rootNodes = await this.#extractBootNodesFromSpec(this.rootNetworkSpecUrl);
    }

    async registerTLD(tld, tldSpec, phrase) {
        try {
            let api = await this.#connect(this.rootNodes);
            await this.#sendTransaction(api, tld, tldSpec, phrase, TxType.TX_ROOT);
        } catch (error) {
            if (error.toString() === "CONNECTION_ERROR") {
                throw new Error("Could not connect to the root network.");
            } else {
                throw error;
            }
        }
    }

    async registerDomain(domain, domainSpec, phrase) {
        try {
            let tld = this.#getTLD(domain);
            let tldSpec = await this.#getTLDSpec(tld);
            let tldBootNodes = await this.#extractBootNodesFromSpec(tldSpec);
            let api = await this.#connect(tldBootNodes);

            await this.#sendTransaction(api, domain, domainSpec, phrase, TxType.TX_TLD);
        } catch (error) {
            if (error.toString() === "CONNECTION_ERROR") {
                throw new Error("Could not connect to the TLD network.");
            } else {
                throw error;
            }
        }
    }

    async #connect(bootNodeList) {
        let api = null;
        let idx = 0;
        while (!api && idx < this.rootNodes.length) {
            api = await polkadotConnect(this.#getConnectionAddress(bootNodeList[idx]));
            idx++;
        }
        if (!api) {
            throw new Error("CONNECTION_ERROR");
        }
        return api;
    }

    async #sendTransaction(api, target, targetSpec, phrase, txType) {
        const keyring = new Keyring({type: 'sr25519'});
        const account = keyring.addFromUri(phrase);

        const targetName = api.createType('BoundedVec<u8, VecSize>', target);
        const chainSpec = api.createType('BoundedVec<u8, VecSize>', targetSpec);

        let tx;

        if (txType === TxType.TX_ROOT) {
            tx = api.tx.rootDNSModule.registerTld(targetName, chainSpec);
        } else {
            tx = api.tx.tldModule.registerDomain(targetName, chainSpec);
        }

        await tx.signAndSend(account);
    }

    async #getTLDSpec(tld) {
        let api = null;
        let idx = 0;
        while (!api && idx < this.rootNodes.length) {
            api = await polkadotConnect(this.#getConnectionAddress(this.rootNodes[idx]));
            idx++;
        }

        if (!api) {
            throw new Error("Could not connect to root DNS network.");
        }
        let res = await api.query.rootDNSModule.tldMap(tld);
        return res.toHuman().chainSpec;
    }

    async #extractBootNodesFromSpec(specUrl) {
        let specJson = await getJSONResponse(specUrl);
        if (specJson && specJson.bootNodes) {
            return specJson.bootNodes;
        } else {
            throw new Error(`Boot nodes not found for chainSpec: ${this.chainSpec}`);
        }
    }

    #getTLD(domain) {
        let domainArr = domain.split('.');
        return domainArr[domainArr.length - 1];
    }

    #getConnectionAddress(bootNodeMPAddr) {
        let addrSpl = bootNodeMPAddr.split('/');
        let addr = addrSpl[2];
        let port = addrSpl[4];
        let connAddr = `http://${addr}:${port}`;
        return connAddr;
    }
}

exports
    .createRegistry = (rootSpecAddr) => {
    return new Registry(rootSpecAddr);
};
