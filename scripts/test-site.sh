#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../

./index.js install

./index.js site \
  port=8080 \
  siteUrl='http://127.0.0.1:8080' \
  homeUrl='http://127.0.0.1:8081' \
  hubUrl='http://127.0.0.1:8000' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &
./index.js home \
  port=8081 \
  siteUrl='http://127.0.0.1:8080' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &
./index.js hub \
  port=8000 \
  hubUrl='http://127.0.0.1:8000' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &

sleep infinity;

popd;
