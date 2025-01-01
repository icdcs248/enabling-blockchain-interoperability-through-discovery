#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <chainId>"
    exit 1
fi

CHAIN_ID=$1

docker rm -f $(docker ps -q --filter name="${CHAIN_ID}_*" )
docker network rm "${CHAIN_ID}_network"

rm *.txt *.json