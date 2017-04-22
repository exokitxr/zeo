#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;

export NODE_TLS_REJECT_UNAUTHORIZED=0

npm start -- install &
INSTALL_PID_1=$!
npm start -- install \
  dataDirectory='data/hub/servers/server_one/data' \
  installDirectory='data/hub/servers/server_one/installed' &
INSTALL_PID_2=$!
npm start -- install \
  dataDirectory='data/hub/servers/server_two/data' \
  installDirectory='data/hub/servers/server_two/installed' &
INSTALL_PID_3=$!
wait $INSTALL_PID_1 $INSTALL_PID_2 $INSTALL_PID_3

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
