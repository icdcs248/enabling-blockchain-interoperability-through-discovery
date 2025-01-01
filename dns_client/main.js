const {createResolver} = require('./dns/resolver');
const {ROOT_DNS_NETWORK_SPEC_ADDR} = require('./config');

const main = async () => {

    if (process.argv.length < 3) {
        console.error("Usage:\n\nnpm start <domain>");
        process.exit(1);
    }

    let domain = process.argv[2];
    let resolver = createResolver(ROOT_DNS_NETWORK_SPEC_ADDR);
    await resolver.init();
    try {
        let reqList = [];
        for (let i = 0; i < 100; i++) {
            reqList.push(resolver.resolve(domain));
        }
        let results = await Promise.all(reqList);
        for (let res of results) {
            if (res.targetSpec) {
                console.log("================================================================");
                console.log("               TARGET SPEC FOUND FOR " + domain);
                console.log("================================================================");
                console.log(res.targetSpec);
                console.log("****************************************************************");
            } else if (res.asset) {
                console.log("================================================================");
                console.log("               ASSET FOUND FOR " + domain);
                console.log("================================================================");
                console.log(res.asset);
                console.log("****************************************************************");
            }
        }
    } catch (err) {
        console.error(`Could not resolve the domain ${domain}.`);
    }
}

main();