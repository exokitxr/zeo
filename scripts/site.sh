#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../

./index.js install

./index.js site home \
  port=443 secure=true \
  cryptoDirectorySrc='defaults/crypto' &
./index.js hub \
  port=8000 secure=true \
  # hubUrl='https://hub.zeovr.io:8000' \
  cryptoDirectorySrc='defaults/crypto' &

sleep infinity;

popd;
