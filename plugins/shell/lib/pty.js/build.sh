#!/bin/bash

DIR="$(dirname "${BASH_SOURCE[0]}")"

cd "$DIR"
if [ ! -f build/Release/pty.node ]; then
  cp binding-src.gyp binding.gyp; # HACK: this is so the module is not picked up as buildable until we explicitly build it here 
  $(node -e "console.log(require.resolve('node-gyp').split('/').slice(0, -2).concat([ 'bin', 'node-gyp.js' ]).join('/'));") rebuild;
  rm binding.gyp;
fi;
