#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../ >/dev/null;
npm start -- makeToken serverHost=insecure.zeovr.io serverType=insecure hubUrl=none
popd >/dev/null;
