#!/bin/bash

CHAIN_ID="local_testnet"
PASSWORD=""
NUMBER_OF_VALIDATORS=2

while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        --chain)
            CHAIN_ID="$2"
            shift # past argument
            shift # past value
            ;;
        --validators)
            NUMBER_OF_VALIDATORS="$2"
            shift # past argument
            shift # past value
            ;;
        *)
            PASSWORD="$1"
            shift # past argument
            ;;
    esac
done

if [ -z "$PASSWORD" ]; then
    echo "Usage: ./gen_keys.sh <password> [--chain <chainId>] [--validators <number_of_validators>]"
    exit 1
fi

# Store keys of all validators in list
declare -a AURA_KEYS
declare -a GRANDPA_KEYS
declare -a SECRET_PHRASES

for i in $(seq 1 $NUMBER_OF_VALIDATORS)
do
    AURA_OUT=$(./target/release/node-template key generate --scheme Sr25519 --password $PASSWORD)
    GRANDPA_OUT=$(./target/release/node-template key generate --scheme Ed25519 --password $PASSWORD)

    SECRET_PHRASE=$(echo $AURA_OUT | grep -oP '(?<=Secret phrase: ).*?(?= Network ID)')

    GRANDPA_OUT=$(./target/release/node-template key inspect --password $PASSWORD --scheme Ed25519 "$SECRET_PHRASE")

    echo $AURA_OUT > "${CHAIN_ID}_aura_keys$i.txt"
    echo $GRANDPA_OUT > "${CHAIN_ID}_grandpa_keys$i.txt"

    AURA_KEY=$(echo $AURA_OUT | grep -oP 'Public key \(SS58\): \K\w+')
    GRANDPA_KEY=$(echo $GRANDPA_OUT | grep -oP 'Public key \(SS58\): \K\w+')

    AURA_KEYS+=("$AURA_KEY")
    GRANDPA_KEYS+=("$GRANDPA_KEY")
    SECRET_PHRASES+=("$SECRET_PHRASE")
done

# Output the keys
AURA_STR=""
GRANDPA_STR=""
SECRET_STR=""

for i in "${!AURA_KEYS[@]}"; do
    AURA_STR+="${AURA_KEYS[$i]} "
    GRANDPA_STR+="${GRANDPA_KEYS[$i]} "
    SECRET_STR+="${SECRET_PHRASES[$i]} "
done

echo "--aura $AURA_STR--grandpa $GRANDPA_STR--secret $SECRET_STR"
