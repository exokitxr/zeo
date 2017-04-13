#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm start -- home my \
  port=8080 \
  hubUrl='https://hub.zeovr.io:8000' \
  dataDirectorySrc='defaults/data' \
  cryptoDirectorySrc='defaults/crypto' \
  installDirectorySrc='installed' &
sleep infinity;
popd;
