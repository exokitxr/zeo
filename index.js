const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const archae = require('archae');
const cryptoutils = require('cryptoutils');
const rnd = require('rnd');
rnd.setSeed(process.env.USER + ';' + process.cwd());

const args = process.argv.slice(2);
const flags = {
  server: args.includes('server'),
  site: args.includes('site'),
  hub: args.includes('hub'),
  install: args.includes('install'),
  makeToken: args.includes('makeToken'),
  host: (() => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const match = arg.match(/^host=(.+)$/);
      if (match) {
        return match[1];
      }
    }
    return null;
  })(),
  port: (() => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const match = arg.match(/^port=([0-9]+)$/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return null;
  })(),
  dataDirectory: (() => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const match = arg.match(/^dataDirectory=(.+)$/);
      if (match) {
        return match[1];
      }
    }
    return null;
  })(),
  cryptoDirectory: (() => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const match = arg.match(/^cryptoDirectory=(.+)$/);
      if (match) {
        return match[1];
      }
    }
    return null;
  })(),
  installDirectory: (() => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const match = arg.match(/^installDirectory=(.+)$/);
      if (match) {
        return match[1];
      }
    }
    return null;
  })(),
  serverHost: (() => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const match = arg.match(/^serverHost=(.+)$/);
      if (match) {
        return match[1];
      }
    }
    return null;
  })(),
  worldname: (() => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const match = arg.match(/^worldname=(.+)$/);
      if (match) {
        return match[1];
      }
    }
    return null;
  })(),
  hubUrl: (() => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const match = arg.match(/^hubUrl=(.+)$/);
      if (match) {
        return match[1];
      }
    }
    return null;
  })(),
  official: (() => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === 'official') {
        return true;
      }
    }
    return false;
  })(),
};
const hasSomeFlag = (() => {
  for (const k in flags) {
    if (flags[k]) {
      return true;
    }
  }
  return false;
})();
if (!hasSomeFlag) {
  flags.server = true;
}

const _capitalize = s => {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
};

const hostname = flags.host || 'zeovr.io';
const port = flags.port || 8000;
const dataDirectory = flags.dataDirectory || 'data';
const cryptoDirectory = flags.cryptoDirectory || 'crypto';
const installDirectory = flags.installDirectory || 'installed';
const staticSite = flags.site && !(flags.hub || flags.server);
const serverHost = flags.serverHost || ('server.' + hostname);
const worldname = flags.worldname || [_capitalize(rnd.adjective()), _capitalize(rnd.noun())].join(' ');
const hubUrl = flags.hubUrl || ('hub.' + hostname + ':' + port);
const official = flags.official || false;
const config = {
  dirname: __dirname,
  hostname: hostname,
  port: port,
  publicDirectory: 'public',
  dataDirectory: dataDirectory,
  cryptoDirectory: cryptoDirectory,
  installDirectory: installDirectory,
  cors: !staticSite,
  corsOrigin: hubUrl,
  staticSite: staticSite,
  metadata: {
    site: {
      url: hostname + ':' + port,
      enabled: flags.site,
    },
    hub: {
      url: hubUrl,
      enabled: flags.hub,
    },
    server: {
      url: serverHost + ':' + port,
      worldname: worldname,
      enabled: flags.server,
      official: official,
    },
  },
};
const a = archae(config);
a.app.getHostname = req => {
  const hostHeader = req.get('Host') || '';
  const match = hostHeader.match(/^([^:]+)(?::[\s\S]*)?$/);
  return match && match[1];
};

const _install = () => {
  if (flags.install) {
    return _getAllPlugins()
     .then(plugins => a.installPlugins(plugins));
  } else {
    return Promise.resolve();
  }
};

const _checkArgs = () => new Promise((accept, reject) => {
  if ((Boolean(flags.hub) + Boolean(flags.server) + Boolean(flags.site)) > 1) {
    const err = new Error('hub, server, and site arguments are mutually exclusive');
    reject(err);
  } else {
    accept();
  }
});

const _loadSign = () => new Promise((accept, reject) => {
  if (flags.hub || flags.server || flags.makeToken) {
    const signDirectory = path.join(__dirname, cryptoDirectory, 'sign');
    const keyPath = path.join(signDirectory, 'key.pem');

    const _getFile = p => new Promise((accept, reject) => {
      fs.readFile(p, (err, d) => {
        if (!err) {
          accept(d);
        } else {
          reject(err);
        }
      });
    });
    const _setFile = (p, d) => new Promise((accept, reject) => {
      fs.writeFile(p, d, err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });

    _getFile(keyPath)
      .then(key => {
        accept(key);
      })
      .catch(err => {
        if (err.code === 'ENOENT') {
          mkdirp(signDirectory, err => {
            if (!err) {
              const auth = require('./lib/auth');
              const key = auth.makeKey();

              _setFile(keyPath, key)
                .then(() => {
                  accept(key);
                })
                .catch(err => {
                  reject(err);
                });
            } else {
              reject(err);
            }
          });
        } else {
          reject(err);
        }
      })
  } else {
    accept();
  }
});

const _loadUserDb = () => {
  if (flags.hub || flags.server) {
    const db = require('./lib/db');
    return db.requestUserDb(path.join(__dirname, dataDirectory, 'db', 'users.db'));
  } else {
    return Promise.resolve();
  }
};

const _load = () => Promise.all([
  _install(),
  _loadSign(),
  _loadUserDb(),
])
  .then(([
    installResult,
    key,
    userDb,
  ]) => ({
    key,
    userDb,
  }));

const _getAllPlugins = () => {
  const _flatten = a => {
    const result = [];
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      result.push.apply(result, e);
    }
    return result;
  };
  const _readdir = p => new Promise((accept, reject) => {
    fs.readdir(p, (err, files) => {
      if (!err) {
        const decoratedFiles = files.map(file => path.join(p, file));
        accept(decoratedFiles);
      } else {
        reject(err);
      }
    });
  });
  const _filterDirectories = files => {
    const acc = [];

    return Promise.all(files.map(file => new Promise((accept, reject) => {
      fs.stat(file, (err, stats) => {
        if (!err) {
          if (stats.isDirectory()) {
            acc.push(file);
          }

          accept();
        } else {
          reject(err);
        }
      });
    }))).then(() => acc);
  };

  return Promise.all([
    path.join(config.dirname, '/core/engines'),
    path.join(config.dirname, '/core/plugins'),
  ].map(_readdir))
    .then(files => _filterDirectories(_flatten(files))
      .then(directories => directories.map(directory => directory.slice(config.dirname.length)))
    );
};

const _listen = ({key, userDb}) => {
  const listenPromises = [];

  if (flags.site) {
    const site = require('./lib/site');
    listenPromises.push(site.listen(a, config, {key, userDb}));
  }
  if (flags.hub) {
    const hub = require('./lib/hub');
    listenPromises.push(hub.listen(a, config, {key, userDb}));
  }
  if (flags.server) {
    const server = require('./lib/server');
    listenPromises.push(server.listen(a, config, {key, userDb}));
  }

  return Promise.all(listenPromises)
    .then(() => {
      if (flags.site || flags.hub || flags.server) {
        return new Promise((accept, reject) => {
          a.listen(err => {
            if (!err) {
              accept();
            } else {
              reject(err);
            }
          });
        });
      } else {
        return Promise.resolve();
      }
    });
};

const _boot = ({key}) => {
  const bootPromises = [];

  if (flags.hub || flags.server) {
    bootPromises.push(
      _getAllPlugins()
        .then(plugins => a.requestPlugins(plugins))
    );
  }
  if (flags.makeToken) {
    const auth = require('./lib/auth');
    bootPromises.push(new Promise((accept, reject) => {
      const token = auth.makeToken({
        key,
      });
      console.log('https://' + config.metadata.server.url + '?t=' + token);

      accept();
    }));
  }

  return Promise.all(bootPromises);
};

_checkArgs()
  .then(() => _load())
  .then(({
    key,
    userDb,
  }) => {
    return _listen({key, userDb})
      .then(() => _boot({key}))
      .then(() => {
        if (flags.site) {
          console.log('https://' + config.metadata.site.url + '/');
        }
        if (flags.hub) {
          console.log('https://' + config.metadata.hub.url + '/');
        }
        if (flags.server) {
          console.log('https://' + config.metadata.server.url + '/');
        }
      });
  })
  .catch(err => {
    console.warn(err);

    process.exit(1);
  });
