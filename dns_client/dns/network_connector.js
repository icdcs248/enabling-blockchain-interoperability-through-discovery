const {polkadotConnect} = require("../polkadot/connector");

class NetworkConnector {
    constructor() {
        this.apiCache = {};
    }

    async connectToNetwork(networkSpec) {
        let networkId = this.#extractNetworkId(networkSpec);
        let bootNodeList = this.#extractBootNodesFromSpecJson(networkSpec);

        if (this.apiCache[networkId]) {
            console.log(`Using cached API for network ${networkId}`)
            return this.apiCache[networkId];
        }

        let api = null;
        while (!api) {
            let node = bootNodeList[Math.floor(Math.random() * bootNodeList.length)];
            console.log(`Trying to connect to ${node}`);
            api = await polkadotConnect(this.#getConnectionAddress(node));
        }
        if (!api) {
            throw new Error("CONNECTION_ERROR");
        }

        this.apiCache[networkId] = api;
        return api;
    }

    #getConnectionAddress(bootNodeMPAddr) {
        let addrSpl = bootNodeMPAddr.split('/');
        let addr = addrSpl[2];
        let port = addrSpl[4];
        let connAddr = `http://${addr}:${port}`;
        return connAddr;
    }

    #extractBootNodesFromSpecJson = (specJson) => {
        if (specJson && specJson.bootNodes) {
            return specJson.bootNodes;
        } else {
            throw new Error(`Boot nodes not found for chainSpec: ${specJson}`);
        }
    }

    #extractNetworkId = (specJson) => {
        if (specJson && specJson.id) {
            return specJson.id;
        } else {
            throw new Error(`Network ID not found for chainSpec: ${specJson}`);
        }
    }
}

exports.createNetworkConnector = () => {
    return new NetworkConnector();
}