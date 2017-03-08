#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../ >/dev/null;
npm start -- makeToken serverHost=hub.zeovr.io hubUrl=none
popd >/dev/null;
