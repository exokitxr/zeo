#!/bin/bash

docker run -ti \
  --rm \
  -p 8000:8000 \
  -v /tmp/.zeo/data:/root/zeo/data \
  modulesio/zeo

popd;
