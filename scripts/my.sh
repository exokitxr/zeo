#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm start -- home my port=8080 homeUrl=my.zeovr.io:8888 hubUrl=hub.zeovr.io:8000 cryptoDirectory=crypto &
sleep infinity;
popd;
