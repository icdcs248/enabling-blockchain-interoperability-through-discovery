# Enabling Blockchain Interoperability Through Discovery

This projects aims to create a discovery mechanism inspired by traditional DNS for the interoperability of blockchain networks.

## Launching Substrate Testnet

The test network consists of two validator nodes and two normal nodes. The following steps can be used to successfully launch it:

1. Clone the substrate node template

```bash
git clone https://github.com/substrate-developer-hub/substrate-node-template.git
```

2. Clone this repository

```bash
git clone https://github.com/khalidzahra/bcdns.git
```

3. Navigate into the template directory and build the substrate node using Cargo

```bash
cd node_template && cargo build --release
```

4. Copy the scripts to the template's directory

```bash
cp -r ../scripts/. . && \
chmod +x init_testnet.sh gen_keys.sh create_spec.sh entrypoint.sh launch_dns_arch.sh cleanup.sh dns_arch_cleanup.sh 
```

5. Copy Containerfile to the template's directory

```bash
cp ../Containerfile .
```

6. Launch the dns architecture 

```bash
./launch_dns_arch.sh
```

## Interacting with the Architecture

The light client implemented in the `dns_client` directory can be used to interact with the architecture. The client can be used to do the following:

> [!IMPORTANT]
> Make sure to install all required packages before running the client by running: 
> ```bash
> cd dns_client && npm install
> ```

### Domain Name Resolution and Asset Discovery
The client can be used to resolve blockchain domain names that have been registered into the DNS. The following command can be used to resolve a domain name:

```bash
npm start <domain_name>
```

The light client can also be used to discover assets that belong to the target chain if they exist and are exposed by that chain.
This is done by using the exact same command as above but with the addition of the asset identifier in the provided domain name like so:

```bash
npm start <domain_name>/asset/<asset_identifier>
``` 

### The Root DNS Network
The chain specifications of the root DNS network should be known to everyone. 
This specification file can be hosted anywhere and the link can then be used by the light client to connect to it. This can easily be done by modifying the `config.js` file.

> [!IMPORTANT]
> The mnemonic phrase to be used for the following transactions can just be the developer phrase `//Alice` for testing purposes.

### TLD Network Registration
A TLD network can be registered into the root DNS network by using the following command:

```bash
npm run register -- --tld <tld> <tld_spec_url> <account_mnemonic_phrase>...
```

### Domain Name Registration
A domain name can be registered into its appropriate TLD network by using the following command:

```bash
npm run register -- --domain <domain_name> <network_spec_url> <account_mnemonic_phrase>...
```

### Asset Registration
An asset can be registered into a target network by using the following command:

```bash
npm run register -- --asset <domain_name> <asset_identifier> <amount> <account_mnemonic_phrase>...
```

## Protocol Diagrams
### Domain name querying
![domain query diagram](./img/domain_query.png)

### Domain name registration
![domain registration diagram](./img/domain_register.png)