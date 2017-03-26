FROM debian:latest

RUN apt-get update && apt-get install -y build-essential cmake python libav-tools libcairo2-dev curl git && apt-get clean
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.1/install.sh | bash
RUN bash -c 'NVM_DIR="/root/.nvm"; . "$NVM_DIR/nvm.sh"; nvm install 7.7.4;'
ENV PATH $PATH:/root/.nvm/versions/node/v7.7.4/bin/
ADD . /root/zeo
RUN bash -c 'cd /root/zeo && npm install'
RUN bash -c 'cd /root/zeo && npm start -- install'

WORKDIR /root/zeo/
ENTRYPOINT ["npm", "start"]
