#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# preinstall core engines as an optimization
pushd "$DIR"/../;
npm start -- install;
popd;
