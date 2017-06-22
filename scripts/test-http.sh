#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../
export NODE_TLS_REJECT_UNAUTHORIZED=0

./index.js install
mkdir -p data/hub/servers/server_one
cp -ralf installed data/hub/servers/server_one/
mkdir -p data/hub/servers/server_two
cp -ralf installed data/hub/servers/server_two/

./index.js site \
  port=8080 \
  siteUrl='http://127.0.0.1:8080' \
  homeUrl='http://127.0.0.1:8081' \
  hubUrl='http://127.0.0.1:8000' \
  forumUrl='http://127.0.0.1:8089' &
./index.js hub \
  port=8000 \
  hubUrl='http://test.zeovr.io:8000' \
  cryptoDirectory='crypto-test-hub' cryptoDirectorySrc='defaults/crypto' \
  installDirectory='installed' installDirectorySrc='installed' &
./index.js server \
  port=7777 \
  siteUrl='http://127.0.0.1:8080' \
  hubUrl='http://127.0.0.1:8000' \
  homeUrl='http://127.0.0.1:8081' \
  vridUrl='http://127.0.0.1:8000' \
  worldname='server_one' \
  dataDirectory='data/hub/servers/server_one/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/hub/servers/server_one/crypto' cryptoDirectorySrc='crypto-test' \
  installDirectory='data/hub/servers/server_one/installed' installDirectorySrc='installed' &
./index.js server \
  port=7778 \
  siteUrl='http://127.0.0.1:8080' \
  hubUrl='http://127.0.0.1:8000' \
  homeUrl='http://127.0.0.1:8081' \
  vridUrl='http://127.0.0.1:8000' \
  worldname='server_two' \
  dataDirectory='data/hub/servers/server_two/data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/hub/servers/server_two/crypto' cryptoDirectorySrc='crypto-test' \
  installDirectory='data/hub/servers/server_two/installed' installDirectorySrc='installed' &

sleep infinity;

popd;
