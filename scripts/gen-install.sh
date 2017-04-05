#!/bin/bash

# This script builds the file structure for the Windows installer
# After it's done, generate the installer with Inno Setup (http://www.innosetup.com) using the script in setup.iss

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../ >/dev/null;
rm -Rf pkg && mkdir -p pkg;
pushd pkg;
aptitude download dpkg-dev g++ gcc libc6-dev make python;
wget https://nodejs.org/dist/v7.8.0/node-v7.8.0-linux-x64.tar.gz;
tar -zxf node-v7.8.0-linux-x64.tar.gz && mv node-v7.8.0-linux-x64 node;
PATH="$(pwd)/node/bin:$PATH";
popd;
rm -Rf node_modules installed;
npm i && npm start -- install;
rm -Rf data crypto .git;
./scripts/lib/install/symlink/pack-symlinks.sh >symlinks.txt;
cp scripts/lib/install/bin/* .;
popd >/dev/null;


