#!/bin/bash

if [ ! -f build/Release/physics.node ]; then
  pushd bullet3;
  ./build.sh;
  popd;
  cp binding-src.gyp binding.gyp; # HACK: this is so the module is not picked up as buildable until we explicitly build it here
  ./node_modules/node-gyp/bin/node-gyp.js rebuild --BULLET_PHYSICS_ROOT="$(pwd)"/bullet3;
  rm binding.gyp;
fi;
