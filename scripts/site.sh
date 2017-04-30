#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../

./index.js install

./index.js site \
  port=8080 secure=true \
  siteUrl='https://zeovr.io:8080' \
  homeUrl='https://zeovr.io:8081' \
  hubUrl='https://zeovr.io:8000' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &
./index.js home \
  port=8081 secure=true \
  siteUrl='https://zeovr.io:8080' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &
./index.js hub \
  port=8000 secure=true \
  hubUrl='https://zeovr.io:8000' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &

sleep infinity;

popd;
