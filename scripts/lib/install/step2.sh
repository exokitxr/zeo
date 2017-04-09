sudo bash -c 'apt-get update && apt-get install -y build-essential python ffmpeg'

curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm

nvm install 7.8.0

cd ~
mkdir -p zeo
cd zeo
npm i modulesio/zeo
cd node_modules/zeo
mkdir -p crypto
cp defaults/crypto/certs/*.pem crypto/
