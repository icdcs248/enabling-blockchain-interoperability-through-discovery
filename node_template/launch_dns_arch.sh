#!/bin/bash

# Check if jq is installed
if ! command -v jq &> /dev/null
then
    echo "jq could not be found, please install it first."
    exit
fi

PASSWORD=1
SPEC_DEFAULT="customSpecRaw.json"

TLD_NUMBER=1
TARGET_NUMBER=2
VALIDATORS=2
NORMAL_NODES=2

while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        --tld)
            TLD_NUMBER="$2"
            shift
            shift
            ;;
        --target)
            TARGET_NUMBER="$2"
            shift
            shift
            ;;
        --validators)
            VALIDATORS="$2"
            shift
            shift
            ;;
        --nodes)
            NORMAL_NODES="$2"
            shift
            shift
            ;;
    esac
done

ROOT_ID="root"

declare -a TLD_IDS=("com_tld" "org_tld" "net_tld" "gov_tld" "edu_tld")
declare -a TARGET_IDS=("example" "whatever" "test" "example2" "example3" "domain" "domain1" "domain2" "domain3" "google" "facebook" "twitter" "instagram" "linkedin" "youtube" "reddit" "tiktok" "snapchat" "whatsapp" "telegram" "signal" "discord" "slack" "microsoft" "apple" "amazon" "netflix" "spotify" "uber" "lyft" "airbnb" "expedia" "tripadvisor" "booking" "priceline" "kayak")
declare -a CHAIN_IDS=($ROOT_ID)
# Add the first $TLD_NUMBER ids from TLD_IDS
CHAIN_IDS+=("${TLD_IDS[@]:0:$TLD_NUMBER}")
# Add the first $TARGET_NUMBER ids from TARGET_IDS
CHAIN_IDS+=("${TARGET_IDS[@]:0:$TARGET_NUMBER}")

mkdir all_specs

for ID in "${CHAIN_IDS[@]}"
do
    if [[ " ${TARGET_IDS[@]:0:$TARGET_NUMBER} " =~ " $ID " ]]; then
        ./init_testnet.sh $PASSWORD --chain $ID --validators 2 --nodes 0
    else
        ./init_testnet.sh $PASSWORD --chain $ID --validators $VALIDATORS --nodes $NORMAL_NODES
    fi

    if [ ! -f "$SPEC_DEFAULT" ]; then
        echo "JSON file not found!"
        exit 1
    fi

    json=$(cat "$SPEC_DEFAULT")
    json=$(echo "$json" | jq '.bootNodes = []')
    cd $ID

    for i in $(seq 1 $VALIDATORS)
    do
        IP_ADDRESS=$(docker inspect -f "{{.NetworkSettings.Networks.${ID}_network.IPAddress}}" "${ID}_node${i}")
        MULTI_PART_ADDR="/ip4/$IP_ADDRESS/tcp/9945/p2p/12D3KooWNL4mZo8y7oAes3VRRnbHy91TDLxnjrDsnMFZkPebB2Rh"
        json=$(echo "$json" | jq --arg addr "$MULTI_PART_ADDR" '.bootNodes += [$addr]')
    done

    echo $json > "../all_specs/${ID}Spec.json"

    cd .. && rm -rf $ID
done

./start_json_server.sh

# Add root nodes to com_tld_network for offchain workers to query com_tld nodes
COM_TLD_NETWORK="com_tld_network"
root_nodes=$(docker ps --format "{{.Names}}" | grep "^root_node")

for root_node in $root_nodes; do
  echo "Connecting container $root_node to $COM_TLD_NETWORK"
  docker network connect $COM_TLD_NETWORK $root_node
done

echo "All specs have been created and are available at http://localhost:3000/json"
