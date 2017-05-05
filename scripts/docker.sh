#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../
export NODE_TLS_REJECT_UNAUTHORIZED=0

docker run -ti \
  --rm \
  -p 8000:8000 \
  -v /tmp/.zeo/data:/root/zeo/data \
  modulesio/zeo

popd;
