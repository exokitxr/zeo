const http = require('http');

const express = require('express');

const archae = require('..');

const server = http.createServer();

const app = express();
app.use('/', express.static(__dirname));

const a = archae();

a.addEngine('/core/engines/react', err => {
  if (!err) {
    console.log('react engine add ok');
  } else {
    console.warn('react engine add fail', err);
  }
});
/* a.addPlugin('react', err => {
  if (!err) {
    console.log('react plugin add ok');
  } else {
    console.warn('react plugin add fail', err);
  }
}); */
a.addPlugin('jquery', err => {
  if (!err) {
    console.log('jquery plugin add ok');
  } else {
    console.warn('jquery plugin add fail', err);
  }
});
a.addPlugin('lodash', err => {
  if (!err) {
    console.log('lodash plugin add ok');
  } else {
    console.warn('lodash plugin add fail', err);
  }
});
/* a.addPlugin('three', err => {
  if (!err) {
    console.log('three plugin add ok');
  } else {
    console.warn('three plugin add fail', err);
  }
}); */

a.listen({server, app});

server.listen(8000);
server.on('listening', () => {
  console.log('listening');
});
server.on('error', err => {
  console.warn(err);
});
