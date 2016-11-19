const http = require('http');

const express = require('express');

const archae = require('..');

const server = http.createServer();

const app = express();
app.use('/', express.static(__dirname));

const a = archae({server, app});

a.requestEngines([
  '/core/engines/express',
  // '/core/engines/react',
  // '/core/engines/ws',
  // '/core/engines/bus',
  // '/core/engines/three',
  '/core/engines/nedb',
  '/core/engines/biolumi',
  '/core/engines/multiplayer',
])
  .then(() => {
    console.log('request engines ok');

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
    console.warn('request engines fail', err);
  });
