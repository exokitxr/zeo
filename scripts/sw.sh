#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

node "$DIR"/../index.js sw \
  port=8000 \
  name='Test server' \
  siteUrl='https://test.zeovr.io:8080' \
  homeUrl='http://127.0.0.1:8081' \
  vridUrl='https://test.zeovr.io:8080' \
  crdsUrl='http://test.zeovr.io:9999' \
  dataDirectory='data' dataDirectorySrc='defaults/data' \
  cryptoDirectory='data/crypto' cryptoDirectorySrc='crypto' \
  installDirectory='data/installed' \
  offline noTty
