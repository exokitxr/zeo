#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
#npm start -- site home \
#  port=443 secure=true \
#  cryptoDirectorySrc='defaults/crypto' &
npm start -- hub \
  port=8000 secure=true \
  hubUrl='https://hub.zeovr.io:8000' \
  cryptoDirectorySrc='defaults/crypto' &
sleep infinity;
popd;
