#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

IMAGE_NAME="zeo-base"

pushd "$DIR"/../core/engines/bullet/;
docker build -t "$IMAGE_NAME" .
popd;
