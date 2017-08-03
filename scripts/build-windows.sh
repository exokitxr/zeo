#!/bin/bash

VERSION="8.1.3";
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/..;

rm -Rf node_modules installed data/mod-hashes.json 'Zeo VR.lnk' node "node-v$VERSION-win-x64" windows-release.zip
npm install
node index.js install
rm package-lock.json
curl "https://nodejs.org/dist/v$VERSION/node-v$VERSION-win-x64.zip" >node.zip
unzip node.zip
rm node.zip
mv "node-v$VERSION-win-x64" node
cp node/node_modules/npm/bin/npm.cmd node/
touch installed/trust-mod-hashes.json
cp 'scripts/lib/windows/Zeo VR.lnk' .
zip -r windows-release.zip . -x /.git* -x /data*
rm -R node
rm 'Zeo VR.lnk'

popd;
