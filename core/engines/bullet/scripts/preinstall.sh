#!/bin/bash

if [ ! -f build/Release/physics.node ]; then
  pushd bullet3;
  ./build.sh;
  popd;
fi;
