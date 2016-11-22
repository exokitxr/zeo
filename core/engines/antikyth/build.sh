#!/bin/bash

if [ ! -f build/Release/physics.node ]; then
  pushd bullet3;
  ./build.sh;
  popd;
  node-gyp rebuild --BULLET_PHYSICS_ROOT="$(pwd)"/bullet3;
fi;
