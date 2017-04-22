#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
export NODE_TLS_REJECT_UNAUTHORIZED=0

npm start -- install
cp -al installed data/hub/servers/server_one/installed
cp -al installed data/hub/servers/server_two/installed

npm start -- site my \
  port=8080 \
  hubUrl='http://test.zeovr.io:8000' &
npm start -- home my \
  port=8081 \
  hubUrl='http://test.zeovr.io:8000' \
  dataDirectory='data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' \
  installDirectory='installed' installDirectorySrc='installed' &
npm start -- hub my \
  port=8000 \
  hubUrl='http://test.zeovr.io:8000' \
  cryptoDirectory='crypto-test-hub' cryptoDirectorySrc='defaults/crypto' \
  installDirectory='installed' installDirectorySrc='installed' &
npm start -- server \
  port=7777 \
  hubUrl='http://test.zeovr.io:8000' \
  homeUrl='http://test.zeovr.io:8081' \
  worldname='server_one' \
  dataDirectory='data/hub/servers/server_one/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/hub/servers/server_one/crypto' cryptoDirectorySrc='crypto-test' \
  installDirectory='data/hub/servers/server_one/installed' installDirectorySrc='installed' &
npm start -- server \
  port=7778 \
  hubUrl='http://test.zeovr.io:8000' \
  homeUrl='http://test.zeovr.io:8081' \
  worldname='server_two' \
  dataDirectory='data/hub/servers/server_two/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/hub/servers/server_two/crypto' cryptoDirectorySrc='crypto-test' \
  installDirectory='data/hub/servers/server_two/installed' installDirectorySrc='installed' &
sleep infinity;
popd;
