const {blake2AsU8a, xxhashAsU8a} = require('@polkadot/util-crypto');
const {u8aToHex} = require('@polkadot/util');
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const {TextEncoder} = require("@polkadot/x-textencoder");
const {polkadotConnect} = require("./polkadot/connector");
const NetworkConnector = require('./dns/network_connector');

const FILES_DIR = path.join(__dirname, 'spec_files');

exports.connector = NetworkConnector.createNetworkConnector();

exports.TxType = Object.freeze({
    TX_ROOT: 0,
    TX_TLD: 1,
    TX_ASSET_CREATE: 2,
    TX_ASSET_QUERY: 3
});

exports.getJSONResponse = async (addr, fileName = null) => {
    try {
        const url = fileName == null ? addr : `${addr}/${fileName}`
        const response = await axios.get(url.replace("json_server", "localhost"))

        if (response.status === 200) {
            console.log(`Retrieved JSON data for ${fileName == null ? addr : fileName}:`)
            return response.data
        }
    } catch (error) {
        console.error(`Error retrieving ${fileName}:`, error.message)
        return null
    }
};

exports.connectToNetwork = async (bootNodeList) => {
    let api = null;
    while (!api) {
        let node = bootNodeList[Math.floor(Math.random() * bootNodeList.length)];
        console.log(`Trying to connect to ${node}`);
        api = await polkadotConnect(getConnectionAddress(node));
    }
    if (!api) {
        throw new Error("CONNECTION_ERROR");
    }
    return api;
}

exports.getTLDSpec = async (tld, rootSpec) => {
    try {
        let api = await this.connector.connectToNetwork(rootSpec);
        let res = await api.query.rootDNSModule.tldMap(tld);
        return res.toHuman().chainSpec;
    } catch (err) {
        throw new Error("Could not connect to root DNS network.");
    }
}

exports.getTargetSpec = async (domain, tldSpec) => {
    try {
        let api = await this.connector.connectToNetwork(tldSpec);
        let res = await api.query.tldModule.domainMap(domain);
        return res.toHuman().chainSpec;
    } catch (err) {
        throw new Error("Could not connect to the TLD network.");
    }
}

exports.extractBootNodesFromSpec = async (specUrl) => {
    let specJson = await this.getJSONResponse(specUrl);
    if (specJson && specJson.bootNodes) {
        return specJson.bootNodes;
    } else {
        throw new Error(`Boot nodes not found for chainSpec: ${specJson}`);
    }
}

exports.getTLD = (domain) => {
    let domainArr = domain.split('.');
    return domainArr[domainArr.length - 1];
}

const getConnectionAddress = (bootNodeMPAddr) => {
    let addrSpl = bootNodeMPAddr.split('/');
    let addr = addrSpl[2];
    let port = addrSpl[4];
    let connAddr = `http://${addr}:${port}`;
    return connAddr;
}


exports.saveJSONFile = (data, fileName) => {
    const filePath = path.join(FILES_DIR, `${fileName}`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved ${fileName}`);
}

exports.generateStorageKey = (moduleName, storageItemName, mapKey) => {
    const moduleHash = xxhashAsU8a(moduleName, 128);
    const storageItemHash = xxhashAsU8a(storageItemName, 128);
    const scale = scaleEncodeString(mapKey)
    const scaleHex = u8aToHex(scale)
    const keyu8 = new Uint8Array([...blake2AsU8a(scaleHex, 128), ...scale])

    const storageKey = u8aToHex(new Uint8Array([...moduleHash, ...storageItemHash, ...keyu8]));

    return storageKey
}

const encodeCompactInteger = (value) => {
    if (value < 1 << 6) {
        // Single byte mode
        return [value << 2];
    } else if (value < 1 << 14) {
        // Two byte mode
        return [(value << 2) | 1, value >> 6];
    } else if (value < 1 << 30) {
        // Four byte mode
        return [(value << 2) | 2, value >> 6, value >> 14, value >> 22];
    } else {
        // Big integer mode
        const bytes = [];
        let length = 0;
        while (value > 0) {
            bytes.push(value & 0xff);
            value = value >> 8;
            length++;
        }
        return [(length - 4 << 2) | 3, ...bytes];
    }
}

const scaleEncodeString = (str) => {
    // Convert the string to a UTF-8 byte array
    const encoder = new TextEncoder();
    const strBytes = encoder.encode(str);

    // Encode the length of the string
    const lengthBytes = encodeCompactInteger(strBytes.length);

    // Combine length and string bytes
    const scaleEncoded = new Uint8Array(lengthBytes.length + strBytes.length);
    scaleEncoded.set(lengthBytes, 0);
    scaleEncoded.set(strBytes, lengthBytes.length);

    return scaleEncoded;
}

exports.decodeScaleString = (scaleEncoded) => {
    // Remove the '0x' prefix and convert to bytes
    const bytes = scaleEncoded.slice(2);

    console.log(scaleEncoded)


    // Get the length byte
    const lengthByte = parseInt(bytes.slice(0, 2), 16);

    console.log(lengthByte)

    // Extract the string bytes
    const stringBytes = bytes.slice(4);

    // Convert string bytes to characters
    let decodedString = "";
    for (let i = 0; i < lengthByte; i++) {
        decodedString += String.fromCharCode(parseInt(stringBytes.slice(i * 2, (i + 1) * 2), 16));
    }

    return decodedString;
}