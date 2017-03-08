#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
npm start -- hub &
npm start -- server port=8001 dataDirectory=data1 cryptoDirectory=crypto1 installDirectory=installed1 serverHost=server1.zeovr.io worldname='Server One' hubUrl=hub.zeovr.io:8000 official &
npm start -- server port=8002 dataDirectory=data2 cryptoDirectory=crypto2 installDirectory=installed2 serverHost=server2.zeovr.io worldname='Server Two' hubUrl=hub.zeovr.io:8000 official &
sleep infinity;
popd;
