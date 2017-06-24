#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../

./index.js server \
  port=7777 \
  siteUrl='https://127.0.0.1:8080' \
  homeUrl='http://127.0.0.1:8081' \
  vridUrl='https://127.0.0.1:8080' \
  dataDirectory='data/servers/server_one/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/servers/server_one/crypto' cryptoDirectorySrc='crypto' \
  installDirectory='data/servers/server_one/installed' &
./index.js server \
  port=7778 \
  siteUrl='https://127.0.0.1:8080' \
  homeUrl='http://127.0.0.1:8081' \
  vridUrl='https://127.0.0.1:8080' \
  dataDirectory='data/servers/server_two/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/servers/server_two/crypto' cryptoDirectorySrc='crypto' \
  installDirectory='data/servers/server_two/installed' &

sleep infinity;

popd;
