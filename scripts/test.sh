#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm start -- site home my host=test.zeovr.io port=8080 homeHost=test-home.zeovr.io hubUrl=test-hub.zeovr.io:8000 cryptoDirectory=crypto-test installDirectory=installed-test &
npm start -- hub my port=8000 homeHost=test-home.zeovr.io hubUrl=test-hub.zeovr.io:8000 cryptoDirectory=crypto-test-hub installDirectory=installed-test-hub &
npm start -- server port=8001 dataDirectory='data/hub/servers/Server One/data' cryptoDirectory='data/hub/servers/Server One/crypto' installDirectory='data/hub/servers/Server One/installed' serverHost=server1.test-home.zeovr.io worldname='Server One' homeHost=test-home.zeovr.io hubUrl=test-hub.zeovr.io:8000 &
npm start -- server port=8002 dataDirectory='data/hub/servers/Server Two/data' cryptoDirectory='data/hub/servers/Server Two/crypto' installDirectory='data/hub/servers/Server Two/installed' serverHost=server2.test-home.zeovr.io worldname='Server Two' homeHost=test-home.zeovr.io hubUrl=test-hub.zeovr.io:8000 &
sleep infinity;
popd;
