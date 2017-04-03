#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm start -- site home port=8080 homeUrl=test-home.zeovr.io:8080 hubUrl=test.zeovr.io:8000 cryptoDirectory=crypto-test &
npm start -- hub port=8000 homeUrl=test-home.zeovr.io:8080 hubUrl=test.zeovr.io:8000 cryptoDirectory=crypto-test &
npm start -- server port=8001 dataDirectory=data/hub/servers/server1/data cryptoDirectory=data/hub/servers/server1/crypto installDirectory=data/hub/servers/server1/installed serverHost=server1.test.zeovr.io worldname='Server One' hubUrl=test.zeovr.io:8000 &
npm start -- server port=8002 dataDirectory=data/hub/servers/server2/data cryptoDirectory=data/hub/servers/server2/crypto installDirectory=data/hub/servers/server2/installed serverHost=server2.test.zeovr.io worldname='Server Two' hubUrl=test.zeovr.io:8000 &
sleep infinity;
popd;
