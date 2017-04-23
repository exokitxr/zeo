#!/bin/bash

if [ ! -f build/Release/physics.node ]; then
  cp binding.js binding.gyp
  "$(node -e 'p = require("path"); console.log(p.join(p.dirname(require.resolve("node-gyp")), "..", "bin", "node-gyp.js"))')" \
    rebuild \
    --BULLET_PHYSICS_ROOT="$(node -e 'p = require("path"); console.log(p.dirname(require.resolve("bullet3")))')"
  rm ./binding.gyp
fi;
