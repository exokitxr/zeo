#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
npm start -- hub &
npm start -- server port=8001 dataDirectory=data1 installDirectory=installed1 serverHost=server1.zeovr.io hubUrl=hub.zeovr.io:8000 &
npm start -- server port=8002 dataDirectory=data2 installDirectory=installed2 serverHost=server2.zeovr.io hubUrl=hub.zeovr.io:8000 &
sleep infinity;
popd;
