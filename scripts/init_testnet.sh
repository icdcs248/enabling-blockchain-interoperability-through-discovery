#!/bin/bash

CHAIN_ID="local_testnet"
PASSWORD=""
NUMBER_OF_VALIDATORS=2
NUMBER_OF_NODES=2

while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        --chain)
            CHAIN_ID="$2"
            shift
            shift
            ;;
        --validators)
            NUMBER_OF_VALIDATORS="$2"
            shift
            shift
            ;;
        --nodes)
            NUMBER_OF_NODES="$2"
            shift
            shift
            ;;
        *)
            PASSWORD="$1"
            shift
            ;;
    esac
done

if [ -z "$PASSWORD" ]; then
    echo "Usage: ./init_testnet.sh <password> [--chain <chainId>] [--validators <number_of_validators>] [--nodes <number_of_nodes>]"
    exit 1
fi

GEN_KEYS_OUT=$(./gen_keys.sh $PASSWORD --chain $CHAIN_ID --validators $NUMBER_OF_VALIDATORS)

AURA_KEYS=$(echo $GEN_KEYS_OUT | awk -F"--aura " '{print $2}' | awk -F" --grandpa" '{print $1}')
GRANDPA_KEYS=$(echo $GEN_KEYS_OUT | awk -F"--grandpa " '{print $2}' | awk -F" --secret" '{print $1}')
SECRET_PHRASES_RAW=$(echo $GEN_KEYS_OUT | awk -F"--secret " '{print $2}')
declare -a SECRET_PHRASES

# Split SECRET_PHRASES into an array
IFS=' ' read -r -a array <<< "$SECRET_PHRASES_RAW"

# Initialize an empty string and counter
phrase=""
counter=0

# Iterate over the array
for element in "${array[@]}"
do
    # Append the element to the phrase
    phrase+="$element "
    counter=$((counter+1))

    # If counter is 12, print the phrase and reset the counter and phrase
    if [ $counter -eq 12 ]; then
        SECRET_PHRASES+=("$phrase")
        counter=0
        phrase=""
    fi
done

IFS=' '

./create_spec.sh $AURA_KEYS --grandpa $GRANDPA_KEYS --chain $CHAIN_ID

docker rmi substrate-template-$CHAIN_ID
docker build -t substrate-template-$CHAIN_ID -f Containerfile .

mkdir $CHAIN_ID && cp customSpecRaw.json ./$CHAIN_ID && cp Containerfile ./$CHAIN_ID && cp entrypoint.sh ./$CHAIN_ID
mkdir -p ./$CHAIN_ID/target/release && cp ./target/release/node-template ./$CHAIN_ID/target/release/
cd ./$CHAIN_ID

DOCKER_NETWORK="${CHAIN_ID}_network"

for ((i=1; i<=$(($NUMBER_OF_NODES+$NUMBER_OF_VALIDATORS)); i++))
do
  echo "Removing ${CHAIN_ID}_node${i}..."
  docker rm -f "${CHAIN_ID}_node${i}"
done

docker network rm $DOCKER_NETWORK

docker network create -d bridge $DOCKER_NETWORK

for ((i=1; i<=$NUMBER_OF_VALIDATORS; i++))
do
  echo "Starting ${CHAIN_ID}_node${i}..."
  SECRET_PHRASE=${SECRET_PHRASES[$((i-1))]}
  if [ $i -lt 10 ]; then
    NODE_KEY="000000000000000000000000000000000000000000000000000000000000000${i}"
  else
    NODE_KEY="00000000000000000000000000000000000000000000000000000000000000${i}"
  fi
  docker run --name "${CHAIN_ID}_node${i}" --network $DOCKER_NETWORK -e "CHAIN_ID=${CHAIN_ID}" -e "NODE_NAME=${CHAIN_ID}_node${i}" -e "SECRET_PHRASE=$SECRET_PHRASE" -e "PASSWORD=$PASSWORD" -e "NODE_KEY=$NODE_KEY" -d substrate-template-$CHAIN_ID
  ((idx++))
done

for ((i=1; i<=$NUMBER_OF_NODES; i++))
do
  NODE_ID=$(($NUMBER_OF_VALIDATORS+$i))
  if [ $i -lt 10 ]; then
    NODE_KEY="000000000000000000000000000000000000000000000000000000000000000${iNODE_ID}"
  else
    NODE_KEY="00000000000000000000000000000000000000000000000000000000000000${NODE_ID}"
  fi
  docker run --name "${CHAIN_ID}_node${NODE_ID}" --network $DOCKER_NETWORK -e "CHAIN_ID=${CHAIN_ID}" -e "NODE_NAME=${CHAIN_ID}_node${NODE_ID}" -e "NORMAL_NODE=true" -e "NODE_KEY=$NODE_KEY" -d substrate-template-$CHAIN_ID
done
