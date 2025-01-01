const WebSocket = require("ws");
const { Metadata, TypeRegistry } = require('@polkadot/types');
const { createType } = require('@polkadot/types/create');
const {generateStorageKey} = require("../util");

exports.getStorage = async (moduleName, storageName, key) => {
    const storageKey = generateStorageKey(moduleName, storageName, key);
    const res = sendRequest("state_getStorage", [storageKey]);
    const rawValue = res.result;

    const registry = new TypeRegistry();

    // Define custom types
    registry.register({
        DomainInfo: {
            trustedNodes: 'Vec<Vec<u8>>',
            available: 'bool'
        }
    });

    const decodedValue = createType(registry, 'DomainInfo', rawValue);

    console.log({
        trustedNodes: decodedValue.trustedNodes.map(node => node.toUtf8()),
        available: decodedValue.available.valueOf()
    });

    return res;
}

const constructRequest = (methodName, params=[]) => {
    return {
        "id":1,
        "jsonrpc":"2.0",
        "method": methodName,
        "params": params
    };
}

const getRpc = (addr="ws://0.0.0.0:9944") => {
    return new Promise((resolve) => {
        const rpc = new WebSocket(addr);
        rpc.on("open", () => {
            resolve(rpc);
        });
    });
}

const sendRequest = async (methodName, params=[]) => {
    const rpc = await getRpc();
    const request = constructRequest(methodName, params);
    rpc.send(JSON.stringify(request));
    return new Promise((resolve) => {
        rpc.onmessage = (msg) => {
            const response = JSON.parse(msg.data);
            rpc.close();
            resolve(response);
        };
    });
}

async function getStorage() {
    const rpc = await getRpc();
    const request = {
        id: 1,
        jsonrpc: "2.0",
        method: "state_getStorage",
        params: ["0xa30b8796a423e8f450cae344dde15822f2c9264389f4e12ed3a16cdcb784d3013990c0eec81410268f76e22d38cb1fb53077686174657665722e636f6d"],
    };

    rpc.send(JSON.stringify(request));

    return new Promise((resolve) => {
        rpc.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            console.log(data);
            const result = data.result;
            rpc.close();
            resolve(result);
        };
    });
}


