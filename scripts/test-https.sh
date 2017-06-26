#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../

./index.js server \
  port=7777 secure=true \
  siteUrl='https://test.zeovr.io:8080' \
  homeUrl='https://test.zeovr.io:8081' \
  vridUrl='https://test.zeovr.io:8080' \
  dataDirectory='data/servers/server_one/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/servers/server_one/crypto' cryptoDirectorySrc='crypto' \
  installDirectory='data/servers/server_one/installed' &
./index.js server \
  port=7778 secure=true \
  siteUrl='https://test.zeovr.io:8080' \
  homeUrl='https://test.zeovr.io:8081' \
  vridUrl='https://test.zeovr.io:8080' \
  dataDirectory='data/servers/server_two/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/servers/server_two/crypto' cryptoDirectorySrc='crypto' \
  installDirectory='data/servers/server_two/installed' &

sleep infinity;

popd;
