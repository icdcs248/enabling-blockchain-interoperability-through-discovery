#!/bin/bash

./target/release/node-template build-spec --disable-default-bootnode --chain local > customSpec.json

# Check if jq is installed
if ! command -v jq &> /dev/null
then
    echo "jq could not be found, please install it first."
    exit
fi

if [ "$#" -lt 2 ]; then
    echo "Usage:\n\n./create_spec <aura_key1> <aura_key2>... --grandpa <grandpa_key1> <grandpa_key2>..."
    exit 1
fi

# Read the JSON from a file
json_file="customSpec.json"
if [ ! -f "$json_file" ]; then
    echo "JSON file not found!"
    exit 1
fi

json=$(cat "$json_file")

# Split the arguments into two arrays: one for aura and one for grandpa
aura_authorities=()
grandpa_authorities=()
chainId="local_testnet"
is_grandpa=false
is_chain=false

for arg in "$@"
do
    if [ "$arg" == "--grandpa" ]; then
        is_grandpa=true
        continue
    fi

    if [ "$arg" == "--chain" ]; then
        is_chain=true
        continue
    fi

    if [ "$is_chain" == true ]; then
        chainId="$arg"
        is_chain=false
        continue
    fi

    if [ "$is_grandpa" == false ]; then
        aura_authorities+=("$arg")
    else
        grandpa_authorities+=("$arg")
    fi
done

# Clear existing authorities
json=$(echo "$json" | jq '.genesis.runtimeGenesis.patch.aura.authorities = []')
json=$(echo "$json" | jq '.genesis.runtimeGenesis.patch.grandpa.authorities = []')

# Add each aura authority to the JSON
for authority in "${aura_authorities[@]}"
do
    json=$(echo "$json" | jq --arg new_authority "$authority" '.genesis.runtimeGenesis.patch.aura.authorities += [$new_authority]')
done

# Add each grandpa authority to the JSON
for authority in "${grandpa_authorities[@]}"
do
    json=$(echo "$json" | jq --arg new_authority "$authority" '.genesis.runtimeGenesis.patch.grandpa.authorities += [[$new_authority, 1]]')
done

json=$(echo "$json" | jq --arg chain_id "$chainId" '.name = $chain_id')
json=$(echo "$json" | jq --arg chain_id "$chainId" '.id = $chain_id')

# Save the updated JSON back to the file
echo "$json" > "$json_file"

echo "Authorities updated successfully."

./target/release/node-template build-spec --chain=customSpec.json --raw --disable-default-bootnode > customSpecRaw.json

echo "Convert chain specifications to raw format."