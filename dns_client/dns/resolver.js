const {
    getJSONResponse,
    getTargetSpec,
    getTLDSpec,
    getTLD,
    connector
} = require("../util");
const fs = require('fs');
const path = require('path');
const {uuid} = require('uuidv4');

class DNSResolver {
    constructor(rootNetworkSpecUrl) {
        this.rootNetworkSpecUrl = rootNetworkSpecUrl;
        this.rootSpec = null
    }

    async init() {
        this.rootSpec = await getJSONResponse(this.rootNetworkSpecUrl);
    }

    async resolveAsset(chainSpec, assetId) {
        try {
            let api = await connector.connectToNetwork(await getJSONResponse(chainSpec));
            let asset = await api.query.assetsModule.asset(assetId);
            return asset.toHuman();
        } catch (error) {
            throw error;
        }
    }

    async resolve(domain) {
        const start = process.hrtime();

        for (let i = 0; i < 1e6; i++) {
            Math.sqrt(i);
        }

        let label = 'execTime.' + uuid();
        console.time(label);
        let parsedDomain = this.#parseAssetDomain(domain);
        try {
            let tld = getTLD(parsedDomain.domain);
            let tldSpec = await getTLDSpec(tld, this.rootSpec);
            let targetSpec = await getTargetSpec(parsedDomain.domain, await getJSONResponse(tldSpec))

            const end = process.hrtime(start);
            const elapsedSeconds = end[0];
            const elapsedNanoseconds = end[1];
            const elapsedMilliseconds = elapsedSeconds * 1000 + elapsedNanoseconds / 1e6;

            console.log(`Elapsed time: ${elapsedMilliseconds.toFixed(3)} ms`);

            const filePath = path.join(__dirname, 'elapsed_time.csv');

            const csvContent = `${elapsedMilliseconds.toFixed(3)}\n`;

            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    // File does not exist, create it with the header and content
                    const header = 'Elapsed Time (ms)\n';
                    fs.writeFile(filePath, header + csvContent, 'utf8', (writeErr) => {
                        if (writeErr) {
                            console.error('Error writing to CSV file', writeErr);
                        } else {
                            console.log('CSV file has been created with the header');
                        }
                    });
                } else {
                    // File exists, append the content
                    fs.appendFile(filePath, csvContent, 'utf8', (appendErr) => {
                        if (appendErr) {
                            console.error('Error appending to CSV file', appendErr);
                        } else {
                            console.log('Elapsed time has been appended to the CSV file');
                        }
                    });
                }
            });

            if (parsedDomain.assetId) {
                let asset = await this.resolveAsset(targetSpec, parsedDomain.assetId);
                console.timeEnd(label);
                return {asset};
            } else {
                console.timeEnd(label);
                return {targetSpec: targetSpec};
            }
        } catch (error) {
            // console.error('Error resolving DNS:', error);
            throw error;
        }
    }

    #parseAssetDomain(domain) {
        let domainArr = domain.split('/');
        return {
            domain: domainArr[0],
            assetId: domainArr.length < 3 || domainArr[1] !== 'asset' ? null : domainArr[2]
        }
    }
}

exports.createResolver = (rootSpecAddr) => {
    return new DNSResolver(rootSpecAddr);
};
