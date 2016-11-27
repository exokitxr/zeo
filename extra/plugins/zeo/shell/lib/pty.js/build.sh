#!/bin/bash

if [ ! -f build/Release/pty.node ]; then
  cp binding-src.gyp binding.gyp; # HACK: this is so the module is not picked up as buildable until we explicitly build it here 
  ./node_modules/node-gyp/bin/node-gyp.js rebuild;
  rm binding.gyp;
fi;
