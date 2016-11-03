const path = require('path');

const express = require('express');
const ws = require('ws');

class ArchaeServer {
  constructor(options) {
    options = options || {};

    this._options = options;
  }

  add(moduleName, cb) {
    cb(); // XXX
  }
  
  remove(moduleName, cb) {
    cb(); // XXX
  }

  listen({server, app}) {
    server = server || http.createServer();
    app = app || express();

    const {_options: options} = this;

    app.use('/', express.static(path.join(__dirname, 'public')));
    server.on('request', app);

    const wss = new ws.Server({
      server,
    });
    wss.on('connection', c => {
      console.log('connection open');

      c.on('message', s => {
        const m = JSON.parse(s);
        console.log('got message', m);
      });
      c.send(JSON.stringify({
        lol: 'zol',
      }));
      c.on('close', () => {
        console.log('connection close');
      });
    });
  }
}

const archae = (opts) => new ArchaeServer(opts);

module.exports = archae;
