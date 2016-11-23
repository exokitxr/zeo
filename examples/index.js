const http = require('http');

const express = require('express');

const archae = require('..');

const server = http.createServer();

const app = express();
app.use('/', express.static(__dirname));

const a = archae({
  server,
  app,
});

a.requestEngines([
  // '/core/engines/express',
  // '/core/engines/react',
  // '/core/engines/ws',
  // '/core/engines/bus',
  // '/core/engines/three',
  '/core/engines/nedb',
  '/core/engines/biolumi',
  '/core/engines/heartlink',
])
  .then(() => {
    console.log('request engines ok');

    a.server.listen(8000);
    a.server.on('listening', () => {
      console.log('listening');
    });
    a.server.on('error', err => {
      console.warn(err);
    });
  })
  .catch(err => {
    console.warn('request engines fail', err);
  });
