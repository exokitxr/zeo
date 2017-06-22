#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../

./index.js install

./index.js site \
  port=8080 secure=true \
  siteUrl='https://zeovr.io:8080' \
  homeUrl='https://zeovr.io:8081' \
  crdsUrl='https://zeovr.io:9999' \
  forumUrl='http://127.0.0.1:8089' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &

sleep infinity;

popd;
