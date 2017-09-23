FROM modulesio/zeo:latest 

RUN apt-get update && apt-get install -y build-essential python curl git && apt-get clean
# Install Chromium.
RUN \
  curl -o- https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
  echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list && \
  apt-get update && \
  apt-get install -y google-chrome-stable && \
  rm -rf /var/lib/apt/lists/*

RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash
RUN bash -c 'NVM_DIR="/root/.nvm"; . "$NVM_DIR/nvm.sh"; nvm install 7.10.0;'
ENV PATH $PATH:/root/.nvm/versions/node/v7.10.0/bin/
ADD . /root/zeo
RUN bash -c 'cd /root/zeo && npm install'

WORKDIR /root/zeo/
ENTRYPOINT ["npm", "start"]
