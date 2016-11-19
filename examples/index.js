const http = require('http');

const express = require('express');

const archae = require('..');

const server = http.createServer();

const app = express();
app.use('/', express.static(__dirname));

const a = archae({server, app});

Promise.all([
  a.requestEngine('/core/engines/express'),
  // a.requestEngine('/core/engines/react'),
  // a.requestEngine('/core/engines/ws'),
  // a.requestEngine('/core/engines/bus'),
  // a.requestEngine('/core/engines/three'),
  a.requestEngine('/core/engines/nedb'),
  a.requestEngine('/core/engines/biolumi'),
  a.requestEngine('/core/engines/multiplayer'),
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
