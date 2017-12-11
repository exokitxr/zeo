#!bin/bash

apt-get update
apt-get install -y \
  build-essential python \
  libx11-xcb-dev libxcomposite-dev libxcursor-dev libxdamage1 libxi6 libxtst6 libnss3 libcups2 libfontconfig1 libxss1 libxrandr2 libgconf-2-4 libasound2 libpangocairo-1.0-0 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0

curl https://nodejs.org/dist/v8.9.3/node-v8.9.3-linux-x64.tar.gz | tar -C /usr/local --strip-components 1 -xzf -
chmod 755 -R /usr/local
echo adduser
adduser --disabled-password --gecos '' ubuntu
echo done adduser
rm -Rf /home/ubuntu/zeo
sudo -u ubuntu HOME=/home/ubuntu git clone --depth 1 https://github.com/modulesio/zeo.git /home/ubuntu/zeo
sudo -u bash -c 'cd /home/ubuntu/zeo && HOME=/home/ubuntu npm install'
# sudo -u ubuntu bash -c '/home/ubuntu/zeo && node index.js server noTty offline &'
