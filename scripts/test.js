#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
npm start -- site hub port=8000 hubUrl=test.zeovr.io:8000 cryptoDirectory=crypto-test &
npm start -- server port=8001 dataDirectory=data/hub/servers/server1/data cryptoDirectory=data/hub/servers/server1/crypto installDirectory=data/hub/servers/server1/installed serverHost=server1.test.zeovr.io worldname='Server One' hubUrl=test.zeovr.io:8000 &
npm start -- server port=8002 dataDirectory=data/hub/servers/server2/data cryptoDirectory=data/hub/servers/server2/crypto installDirectory=data/hub/servers/server2/installed serverHost=server2.test.zeovr.io worldname='Server Two' hubUrl=test.zeovr.io:8000 &
sleep infinity;
popd;
