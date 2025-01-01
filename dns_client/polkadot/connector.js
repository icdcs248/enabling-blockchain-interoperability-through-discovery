const {HttpProvider, ApiPromise} = require("@polkadot/api");
exports.polkadotConnect = async (addr = 'http://127.0.0.1:9944') => {
    const provider = new HttpProvider(addr);
    let api;

    try {
        // Create an instance of the API and handle errors
        api = new ApiPromise({provider});

        // Handle any errors that might occur during API initialization
        api.on('error', (error) => {
            console.error('API error encountered:', error.message || error);
        });

        // Await the API to be ready
        await api.isReadyOrError;

        const [chain, nodeName, nodeVersion] = await Promise.all([
            api.rpc.system.chain(),
            api.rpc.system.name(),
            api.rpc.system.version()
        ]);

        console.log(`Connected to chain: ${chain}`);
        console.log(`Using node: ${nodeName} v${nodeVersion}`);

        return api;
    } catch (err) {
        return null;
    }
}