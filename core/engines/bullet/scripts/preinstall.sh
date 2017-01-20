#!/bin/bash

if [ ! -f build/Release/physics.node ]; then
  pushd bullet3;
  ./build.sh;
  popd;
  ./node_modules/node-gyp/bin/node-gyp.js rebuild --BULLET_PHYSICS_ROOT="$(pwd)"/bullet3;
fi;
