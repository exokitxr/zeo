#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm start -- site home my \
  host=test.zeovr.io port=8080 \
  homeHost=test-home.zeovr.io \
  hubUrl=test-hub.zeovr.io:8000 \
  dataDirectory=data dataDirectorySrc='defaults/data' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' \
  installDirectory='installed-test' installDirectorySrc='installed-test' &
npm start -- hub my \
  port=8000 \
  homeHost=test-home.zeovr.io \
  hubUrl=test-hub.zeovr.io:8000 \
  cryptoDirectory='crypto-test-hub' cryptoDirectorySrc='defaults/crypto' \
  installDirectory='installed-test-hub' installDirectorySrc='installed-test' &
npm start -- server \
  port=8001 \
  homeHost=test-home.zeovr.io hubUrl=test-hub.zeovr.io:8000 \
  serverHost=server1.test-home.zeovr.io worldname='Server One' \
  dataDirectory='data/hub/servers/Server One/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/hub/servers/Server One/crypto' cryptoDirectorySrc='crypto-test' \
  installDirectory='data/hub/servers/Server One/installed' installDirectorySrc='installed-test' &
npm start -- server \
  port=8002 \
  homeHost=test-home.zeovr.io hubUrl=test-hub.zeovr.io:8000 \
  serverHost=server2.test-home.zeovr.io worldname='Server Two' \
  dataDirectory='data/hub/servers/Server Two/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/hub/servers/Server Two/crypto' cryptoDirectorySrc='crypto-test' \
  installDirectory='data/hub/servers/Server Two/installed' installDirectorySrc='installed-test' &
sleep infinity;
popd;
