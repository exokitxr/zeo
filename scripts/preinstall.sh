#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# prebuild bullet engine as an optimization
pushd "$DIR"/../core/engines/bullet/ >/dev/null;
npm install;
popd >/dev/null;
