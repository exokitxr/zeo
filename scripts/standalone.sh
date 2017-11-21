#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../

./index.js server \
  port="$PORT" \
  siteUrl='https://zeovr.io' \
  vridUrl='https://zeovr.io'

popd;
