const http = require('http');

const express = require('express');

const archae = require('..');

const server = http.createServer();

const app = express();
app.use('/', express.static(__dirname));

const a = archae({server, app});

Promise.all([
  a.addEngine('/core/engines/express'),
  a.addEngine('/core/engines/react'),
  // a.addEngine('/core/engines/ws'),
  // a.addEngine('/core/engines/bus'),
  a.addEngine('/core/engines/biolumi'),
  a.addEngine('/core/engines/multiplayer'),
])
  .then(() => {
    console.log('adds ok');

    a.listen(err => {
      if (!err) {
        server.listen(8000);
        server.on('listening', () => {
          console.log('listening');
        });
        server.on('error', err => {
          console.warn(err);
        });
      } else {
        console.warn(err);
      }
    });
  })
  .catch(err => {
    console.warn('react engine add fail', err);
  });
