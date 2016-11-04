const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const express = require('express');
const ws = require('ws');
const mkdirp = require('mkdirp');

class ArchaeServer {
  constructor(options) {
    options = options || {};

    this._options = options;
  }

  addPlugin(plugin, opts, cb) {
    if (cb === undefined) {
      cb = opts;
      opts = {};
    }

    mkdirp(path.join(__dirname, 'plugins'), err => {
      if (!err) {
        const pluginBuildPath = path.join(__dirname, 'plugins', 'build', plugin + '.js');
        fs.exists(pluginBuildPath, exists => {
          if (!exists || opts.force) {
            const yarnAdd = child_process.spawn(
              // path.join(__dirname, 'node_modules', 'yarn', 'bin', 'yarn'),
              'yarn',
              [ 'add', plugin ],
              {
                cwd: path.join(__dirname, 'plugins'),
              }
            );
            yarnAdd.stdout.pipe(process.stdout);
            yarnAdd.stderr.pipe(process.stderr);
            yarnAdd.on('close', code => {
              if (code === 0) {
                const pluginPath = path.join(__dirname, 'plugins', 'node_modules', plugin);

                const webpack = child_process.spawn(
                  path.join(__dirname, 'node_modules', 'webpack', 'bin', 'webpack.js'),
                  [ pluginPath, pluginBuildPath ],
                  {
                    cwd: __dirname,
                  }
                );
                webpack.stdout.pipe(process.stdout);
                webpack.stderr.pipe(process.stderr);
                webpack.on('close', code => {
                  if (code === 0) {
                    cb();
                  } else {
                    const err = new Error('webpack error: ' + code);
                    cb(err);
                  }
                });
              } else {
                const err = new Error('yard add error: ' + code);
                cb(err);
              }
            });
          } else {
            cb();
          }
        });
      } else {
        console.warn(err);
      }
    });
  }
  
  removePlugin(plugin, opts, cb) {
    if (cb === undefined) {
      cb = opts;
      opts = {};
    }

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
