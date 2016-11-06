const http = require('http');

const express = require('express');

const archae = require('..');

const server = http.createServer();

const app = express();
app.use('/', express.static(__dirname));

const a = archae();

Promise.all([
  a.addEngine('/core/engines/express'),
  a.addEngine('/core/engines/react'),
  a.addEngine('/core/engines/biolumi'),
])
  .then(() => {
    console.log('adds ok');

    a.listen({server, app}, err => {
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
