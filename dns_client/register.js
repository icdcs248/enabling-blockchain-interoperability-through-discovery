const {ROOT_DNS_NETWORK_SPEC_ADDR} = require('./config');
const {createRegistry} = require('./dns/registry');

const readPhrase = (startIndex = 5) => {
    let idx = startIndex;
    let phrase = "";
    while (process.argv[idx]) {
        if (idx !== startIndex) phrase += " ";
        phrase += process.argv[idx];
        idx++;
    }
    return phrase;
}

const register = async () => {
    if (process.argv.length < 5) {
        console.error("Usage:\n\nnpm run register [--tld <tld> <spec> <phrase>...] [--domain <domain> <spec> <phrase>...]");
        process.exit(1);
    }

    let registry = createRegistry(ROOT_DNS_NETWORK_SPEC_ADDR, process.argv[2] === "--asset" ? readPhrase(6) : readPhrase());
    await registry.init();

    if (process.argv[2] === "--tld") {
        let target = process.argv[3];
        let targetSpec = process.argv[4];
        await registry.registerTLD(target, targetSpec);
        console.log("Registered TLD in root network.");
    } else if (process.argv[2] === "--domain") {
        let target = process.argv[3];
        let targetSpec = process.argv[4];
        await registry.registerDomain(target, targetSpec);
        console.log("Registered domain in TLD network.");
    } else if (process.argv[2] === "--asset") {
        let domain = process.argv[3];
        let assetId = process.argv[4];
        let amount = process.argv[5];
        await registry.registerAsset(domain, assetId, amount);
        console.log("Registered asset on target network.");
    } else if (process.argv[2] === "--help") {
        console.error("Usage:\n\nnpm run register [--tld <tld> <spec> <phrase>...] [--domain <domain> <spec> <phrase>...]");
    }
}

register();