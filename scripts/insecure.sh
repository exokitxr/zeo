#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../ >/dev/null;
npm start -- server serverHost=insecure.zeovr.io hubUrl=none worldname=zeo &
sleep infinity;
popd >/dev/null;
