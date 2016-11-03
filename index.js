const http = require('http');
const express = require('express');

const st = require('st');

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

  listen(server) {
    const {_options: options} = this;

    const app = express();

    /* app.all(/^\/archae(?:\/|$)/, (req, res, next) => {
      const u = req.url.replace(/^\/archae/, '');

      res.send('ok');
    }); */

    const static = st({
      path: path.join(__dirname, 'public'),
      url: '/',
    });
    app.get('*', (req, res, next) => {
      static(req, res);
    });
    server.on('request', app);

    const wss = new WebSocketServer({
      server,
    });
    wss.on('connection', c => {
      console.log('got connection');

      c.send('lol');
    });
  }
}

const archae = (opts) => new ArchaeServer(opts);

module.exports = archae;
