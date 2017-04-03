#!/bin/bash

# This script builds the file structure for the Windows installer
# After it's done, generate the installer with Inno Setup (http://www.innosetup.com) using the script in setup.iss

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../ >/dev/null;
rm -Rf pkg && mkdir -p pkg;
pushd pkg;
aptitude download dpkg-dev g++ gcc libc6-dev make python expect;
wget https://nodejs.org/dist/v7.8.0/node-v7.8.0-linux-x64.tar.gz;
tar -zxf node-v7.8.0-linux-x64.tar.gz && mv node-v7.8.0-linux-x64 node;
PATH="$(pwd)/node/bin:$PATH";
popd;
rm -Rf node_modules installed;
npm i && npm start -- install;
git clone --depth 1 https://github.com/modulesio/firefox-nightly-portable pkg/FirefoxNightlyPortable && rm -Rf pkg/FirefoxNightlyPortable/.git;
pushd pkg/FirefoxNightlyPortable;
cat prefs.js | node -e 'let dirname = process.cwd().replace(/^\/mnt\//, ""); dirname = dirname[0].toUpperCase() + ":" + dirname.slice(1) + "/"; dirname = dirname.replace(/\//g, "\\"); let s = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", d => { s += d; }); process.stdin.on("end", () => { s = s.replace(/DIRNAME/g, dirname); process.stdout.write(s); }); ' >Data/profile/prefs.js;
popd;
rm -Rf data crypto .git;
./scripts/lib/install/symlink/pack-symlinks.sh >symlinks.txt;
cp scripts/lib/install/bin/* .;
popd >/dev/null;


