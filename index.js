const path = require('path');
const http = require('http');

const express = require('express');
const archae = require('archae');

const app = express();
app.get('/vr', (req, res, next) => {
  req.url = '/vr.html';

  next('route');
});
app.use('/', express.static(path.join(__dirname, 'public')));

const a = archae({
  dirname: __dirname,
  app,
});
a.server.listen(8000);
a.server.on('listening', () => {
  console.log('listening');
});
a.server.on('error', err => {
  console.warn(err);
});
