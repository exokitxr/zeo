#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../
export NODE_TLS_REJECT_UNAUTHORIZED=0

./index.js server \
  port="$PORT" \
  siteUrl='https://zeovr.io' \
  hubUrl='https://hub.zeovr.io:8000' \
  vridUrl='https://zeovr.io' \
  dataDirectorySrc='defaults/data' \
  cryptoDirectorySrc='defaults/crypto' \
  installDirectorySrc='installed'

popd;
