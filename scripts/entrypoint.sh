#!/bin/sh

/substrate/target/release/node-template key insert --base-path /tmp/$NODE_NAME \
  --chain customSpecRaw.json \
  --scheme Sr25519 \
  --suri "$SECRET_PHRASE" \
  --password $PASSWORD \
  --key-type aura

/substrate/target/release/node-template key insert \
  --base-path /tmp/$NODE_NAME \
  --chain customSpecRaw.json \
  --scheme Ed25519 \
  --suri "$SECRET_PHRASE" \
  --password $PASSWORD \
  --key-type gran

# 12D3KooWEyoppNCUx8Yx66oV9fJnriXwCcXwDDUA2kj6vnc6iDEp

if [ $NORMAL_NODE ]
then
/substrate/target/release/node-template \
  --base-path /tmp/$NODE_NAME \
  --chain ./customSpecRaw.json \
  --port 30333 \
  --rpc-port 9945 \
  --telemetry-url "wss://telemetry.polkadot.io/submit/ 0" \
  --rpc-cors all \
  --rpc-external \
  --rpc-methods Unsafe \
  --rpc-max-connections 1000 \
  --rpc-max-subscriptions-per-connection 5000 \
  --name $NODE_NAME 
else
/substrate/target/release/node-template \
  --node-key $NODE_KEY \
  --base-path /tmp/$NODE_NAME \
  --chain ./customSpecRaw.json \
  --port 30333 \
  --rpc-port 9945 \
  --telemetry-url "wss://telemetry.polkadot.io/submit/ 0" \
  --validator \
  --rpc-cors all \
  --rpc-external \
  --rpc-methods Unsafe \
  --rpc-max-connections 1000 \
  --rpc-max-subscriptions-per-connection 5000 \
  --name $NODE_NAME \
  --bootnodes /dns/substrate_node1/tcp/30333/p2p/12D3KooWEyoppNCUx8Yx66oV9fJnriXwCcXwDDUA2kj6vnc6iDEp \
  --password $PASSWORD
fi

