#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../
export NODE_TLS_REJECT_UNAUTHORIZED=0

./index.js install
mkdir -p data/hub/servers/server_one
cp -ralf installed data/hub/servers/server_one/
mkdir -p data/hub/servers/server_two
cp -ralf installed data/hub/servers/server_two/

./index.js server \
  port=7777 secure=true \
  siteUrl='https://zeovr.io:8080' \
  homeUrl='https://zeovr.io:8081' \
  vridUrl='https://zeovr.io:8080' \
  worldname='server_one' \
  dataDirectory='data/hub/servers/server_one/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/hub/servers/server_one/crypto' cryptoDirectorySrc='crypto-test' \
  installDirectory='data/hub/servers/server_one/installed' installDirectorySrc='installed' &
./index.js server \
  port=7778 secure=true \
  siteUrl='https://zeovr.io:8080' \
  homeUrl='https://zeovr.io:8081' \
  vridUrl='https://zeovr.io:8080' \
  worldname='server_two' \
  dataDirectory='data/hub/servers/server_two/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/hub/servers/server_two/crypto' cryptoDirectorySrc='crypto-test' \
  installDirectory='data/hub/servers/server_two/installed' installDirectorySrc='installed' &

sleep infinity;

popd;
