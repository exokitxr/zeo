#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../;
npm start -- makeToken serverHost=insecure.zeovr.io serverType=insecure hubUrl=none
popd;
