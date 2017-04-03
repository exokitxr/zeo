#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm start -- site home my port=8080 homeUrl=test-home.zeovr.io:8080 hubUrl=test-hub.zeovr.io:8000 cryptoDirectory=crypto-test &
npm start -- hub my newline port=8000 homeUrl=test-home.zeovr.io:8080 hubUrl=test-hub.zeovr.io:8000 cryptoDirectory=crypto-test-hub >/tmp/zeo-hub-log.txt &
tail -f /tmp/zeo-hub-log.txt | expect -c 'expect -re "Hub:"'
npm start -- server port=8001 dataDirectory=data/hub/servers/server1/data cryptoDirectory=data/hub/servers/server1/crypto installDirectory=data/hub/servers/server1/installed serverHost=server1.test-home.zeovr.io worldname='Server One' hubUrl=test-hub.zeovr.io:8000 &
npm start -- server port=8002 dataDirectory=data/hub/servers/server2/data cryptoDirectory=data/hub/servers/server2/crypto installDirectory=data/hub/servers/server2/installed serverHost=server2.test-home.zeovr.io worldname='Server Two' hubUrl=test-hub.zeovr.io:8000 &
sleep infinity;
popd;
