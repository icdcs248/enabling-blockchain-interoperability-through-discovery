import {getJSONResponse} from "../util";
import {polkadotConnect} from "../polkadot/connector";

class DNSResolver {
    constructor(rootNetworkSpecUrl) {
        this.rootNetworkSpecUrl = rootNetworkSpecUrl;
        this.rootNodes = []
    }

    async init() {
        this.rootNodes = await this.#extractBootNodesFromSpec(this.rootNetworkSpecUrl);
    }

    async resolve(domain) {
        try {
            let tld = this.#getTLD(domain);
            let tldSpec = await this.#getTLDSpec(tld);
            let targetSpec = await this.#getTargetSpec(domain, await this.#extractBootNodesFromSpec(tldSpec))
            return targetSpec.toHuman().chainSpec;
        } catch (error) {
            // console.error('Error resolving DNS:', error);
            throw error;
        }
    }

    async #getTargetSpec(domain, tldBootNodes) {
        let api = null;
        let idx = 0;
        while (!api && idx < tldBootNodes.length) {
            api = await polkadotConnect(this.#getConnectionAddress(tldBootNodes[idx]));
            idx++;
        }

        if (!api) {
            throw new Error("Could not connect to the TLD network.");
        }

        return await api.query.tldModule.domainMap(domain);
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

exports.createResolver = (rootSpecAddr) => {
    return new DNSResolver(rootSpecAddr);
};
