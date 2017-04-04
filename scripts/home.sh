#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
# npm start -- site home port=80 &
npm start -- hub dns port=8000 hubUrl=hub.zeovr.io:8000 dnsPort=53 &
sleep infinity;
popd;
