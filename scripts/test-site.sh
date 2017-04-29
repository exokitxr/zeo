#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../

./index.js site home \
  port=8080 secure=true \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &
./index.js hub \
  port=8000 secure=true \
  # hubUrl='https://hub.zeovr.io:8000' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &

sleep infinity;

popd;
