#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../

./index.js install

./index.js site \
  port=8080 \
  siteUrl='http://127.0.0.1:8080' \
  homeUrl='http://127.0.0.1:8081' \
  crdsUrl='http://127.0.0.1:9999' \
  forumUrl='http://127.0.0.1:8089' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &

sleep infinity;

popd;
