#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
npm start -- site hub server &
npm start -- server port=8001 dataDirectory=data2 installDirectory=installed2 serverHost=server1.zeovr.io serverType=insecure hubUrl=hub.zeovr.io:8000 &
sleep infinity;
popd;
