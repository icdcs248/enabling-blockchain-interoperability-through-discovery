#!/bin/bash

./copy_specs.sh

docker rm -f json_server

docker rmi json_server

docker build -t json_server ./../json_server/.

docker run -d -p 3000:3000 --name json_server --network root_network json_server

echo "JSON Server is running on http://localhost:3000"