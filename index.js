const path = require('path');
const http = require('http');
const archae = require('archae');

const a = archae({
  dirname: __dirname,
  hostname: 'zeo.sh',
  port: 8000,
  publicDirectory: 'public',
  dataDirectory: 'data',
});
a.app.get('/vr', (req, res, next) => {
  req.url = '/vr.html';

  next('route');
});
a.listen(err => {
  if (!err) {
    console.log('listening');
  } else {
    console.warn(err);
  }
});
