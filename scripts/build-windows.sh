#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/..;

curl https://nodejs.org/dist/v8.1.3/node-v8.1.3-win-x64.zip >node.zip
unzip node.zip
rm node.zip
mv node-v8.1.2-win-x64 node
cp node/node_modules/npm/bin/npm.cmd node/
./index.js install
touch installed/trust-mod-hashes.json
cp 'scripts/lib/windows/Zeo VR.lnk' .
zip -r windows-release.zip . -x /.git* -x /data*
rm -R node
rm -R installed
rm 'Zeo VR.lnk'

popd;
