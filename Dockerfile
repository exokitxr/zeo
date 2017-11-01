FROM debian:latest

RUN apt-get update && apt-get install -y curl gnupg && apt-get clean
RUN curl -o- https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
  echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list && \
  apt-get update && apt-get install -y build-essential python curl git google-chrome-stable && apt-get clean
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.6/install.sh | bash && \
  bash -c 'NVM_DIR="/root/.nvm"; . "$NVM_DIR/nvm.sh"; nvm install 8.9.0;'
ENV PATH $PATH:/root/.nvm/versions/node/v8.9.0/bin/
ADD . /root/zeo
RUN bash -c 'cd /root/zeo && npm install --unsafe-perm'

WORKDIR /root/zeo/
ENTRYPOINT ["npm", "start"]
