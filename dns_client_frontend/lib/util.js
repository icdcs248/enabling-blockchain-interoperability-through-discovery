import {blake2AsU8a, xxhashAsU8a} from '@polkadot/util-crypto';
import {u8aToHex} from '@polkadot/util';
import axios from 'axios';
import {TextEncoder} from "@polkadot/x-textencoder";

exports.TxType = Object.freeze({
    TX_ROOT: 0,
    TX_TLD: 1,
});

exports.getJSONResponse = async (addr, fileName = null) => {
    try {
        const url = fileName == null ? addr : `${addr}/${fileName}`
        const response = await axios.get(url)

        if (response.status === 200) {
            console.log(`Retrieved JSON data for ${fileName}:`)
            return response.data
        }
    } catch (error) {
        console.error(`Error retrieving ${fileName}:`, error.message)
        return null
    }
};

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