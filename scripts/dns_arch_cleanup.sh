#!/bin/bash

# Remove all docker containers belonging to the substrate-template image
docker ps -a --format "{{.ID}} {{.Image}}" | grep "substrate-template" | awk '{print $1}' | xargs docker rm -f

# Remove json_server container
docker rm -f json_server

# Remove folder containing all spec files
rm -rf all_specs *.txt

# Remove trailing images and all unused networks
docker system prune -af