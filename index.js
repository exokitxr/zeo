const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const mkdirp = require('mkdirp');
const archae = require('archae');
const rnd = require('rnd');
rnd.setSeed(process.env.USER + ';' + process.cwd());

const args = process.argv.slice(2);
const _findArg = name => {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const match = arg.match(new RegExp('^' + name + '=(.+)$'));
    if (match) {
      return match[1];
    }
  }
  return null;
};
const flags = {
  server: args.includes('server'),
  site: args.includes('site'),
  home: args.includes('home'),
  hub: args.includes('hub'),
  install: args.includes('install'),
  host: _findArg('host'),
  port: (() => {
    const s = _findArg('port');

    if (s && /^[0-9]+$/.test(s)) {
      return parseInt(s, 10);
    } else {
      return null;
    }
  })(),
  secure: (() => {
    const secure = _findArg('secure');

    if (secure === String(true)) {
      return true;
    } else if (secure === String(false)) {
      return false;
    } else {
      return null;
    }
  })(),
  dataDirectory: _findArg('dataDirectory'),
  cryptoDirectory: _findArg('cryptoDirectory'),
  installDirectory: _findArg('installDirectory'),
  dataDirectorySrc: _findArg('dataDirectorySrc'),
  cryptoDirectorySrc: _findArg('cryptoDirectorySrc'),
  installDirectorySrc: _findArg('installDirectorySrc'),
  worldname: _findArg('worldname'),
  hubUrl: _findArg('hubUrl'),
  homeUrl: _findArg('homeUrl'),
  my: args.includes('my'),
  launch: _findArg('launch'),
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
const secure = (typeof flags.secure === 'boolean') ? flags.secure : false;
const dataDirectory = flags.dataDirectory || 'data';
const cryptoDirectory = flags.cryptoDirectory || 'crypto';
const installDirectory = flags.installDirectory || 'installed';
const dataDirectorySrc = flags.dataDirectorySrc || dataDirectory;
const cryptoDirectorySrc = flags.cryptoDirectorySrc || cryptoDirectory;
const installDirectorySrc = flags.installDirectorySrc || installDirectory;
const staticSite = flags.site && !(flags.home || flags.hub || flags.server);
const worldname = flags.worldname || [_capitalize(rnd.adjective()), _capitalize(rnd.noun())].join(' ');
const protocolString = !secure ? 'http' : 'https';
const hubUrl = flags.hubUrl || (protocolString + '://hub.' + hostname + ':' + port);
const homeUrl = flags.homeUrl || (protocolString + '://127.0.0.1:' + port);
const config = {
  dirname: __dirname,
  hostname: hostname,
  port: port,
  secure: secure,
  publicDirectory: 'public',
  dataDirectory: dataDirectory,
  cryptoDirectory: cryptoDirectory,
  installDirectory: installDirectory,
  cors: !staticSite,
  corsOrigin: homeUrl,
  staticSite: staticSite,
  metadata: {
    config: {
      dataDirectorySrc: dataDirectorySrc,
      cryptoDirectorySrc: cryptoDirectorySrc,
      installDirectorySrc: installDirectorySrc,
    },
    site: {
      url: protocolString + '://' + hostname + ':' + port,
      enabled: flags.site,
    },
    home: {
      url: homeUrl,
      enabled: flags.home,
    },
    hub: {
      url: hubUrl,
      enabled: flags.hub,
    },
    server: {
      url: homeUrl,
      worldname: worldname,
      enabled: flags.server,
    },
    my: {
      enabled: flags.my || false,
    },
  },
};
const a = archae(config);

const _install = () => {
  if (flags.install) {
    return _getAllPlugins()
      .then(plugins => a.installPlugins(plugins, {force: true}));
  } else {
    return Promise.resolve();
  }
};

const worldnameRegexp = /^[a-z][a-z0-9_-]*/i;
const _checkArgs = () => {
  if ((Number(Boolean(flags.hub)) + Number(Boolean(flags.home)) + Number(Boolean(flags.server))) > 1) {
    return Promise.reject(new Error('hub, server, and site arguments are mutually exclusive'));
  } else if (flags.worldname && !worldnameRegexp.test(flags.worldname)) {
    return Promise.reject(new Error('worldname must match ' + String(worldnameRegexp)));
  } else {
    return Promise.resolve();
  }
};

const _preload = () => {
  if (flags.hub || flags.home || flags.server) {
    const crypto = require('./lib/crypto');
    return crypto.preload(a, config);
  } else {
    return Promise.resolve();
  }
};

const _loadSign = () => new Promise((accept, reject) => {
  if (flags.hub || flags.server) {
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
    path.join(config.dirname, '/core/utils'),
  ].map(_readdir))
    .then(files => _filterDirectories(_flatten(files))
      .then(directories =>
        directories.map(directory => directory.slice(config.dirname.length))
          .concat([ // preinstalled plugins for hub tutorial
            '/plugins/z-cake',
          ])
      )
    );
};

const _listenLibs = ({key, userDb}) => {
  const listenPromises = [];

  if (flags.site) {
    const site = require('./lib/site');
    listenPromises.push(site.listen(a, config, {key, userDb}));
  }
  if (flags.home) {
    const home = require('./lib/home');
    listenPromises.push(home.listen(a, config, {key, userDb}));
  }
  if (flags.hub) {
    const hub = require('./lib/hub');
    listenPromises.push(hub.listen(a, config, {key, userDb}));
  }
  if (flags.server) {
    const server = require('./lib/server');
    listenPromises.push(server.listen(a, config, {key, userDb}));
  }

  return Promise.all(listenPromises);
};

const _lockArchae = () => {
  if (flags.hub) {
    a.lock();

    return _getAllPlugins()
      .then(plugins => {
        a.setWhitelist(plugins);
      });
  } else {
    return Promise.resolve();
  }
};

const _listenArchae = () => {
  if (flags.site || flags.home || flags.hub || flags.server) {
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
};

const _boot = ({key}) => {
  const bootPromises = [];

  if (flags.hub || flags.server) {
    bootPromises.push(
      _getAllPlugins()
        .then(plugins => a.requestPlugins(plugins))
    );
  }

  return Promise.all(bootPromises);
};

const _launch = () => {
  if (flags.launch) {
    console.log('launch command: ' + JSON.stringify(flags.launch));

    const launchProcess = child_process.exec(flags.launch);
    launchProcess.stdout.pipe(process.stdout);
    launchProcess.stderr.pipe(process.stderr);
    launchProcess.on('error', err => {
      console.warn(err);
    });

    let live = true;
    launchProcess.on('exit', code => {
      console.log('launch process exited with code: ' + JSON.stringify(code));

      if (live) {
        process.exit();

        live = false;
      }
    });
    process.on('exit', () => {
      if (live) {
        console.log('terminating launch process');

        launchProcess.kill();

        live = false;
      }
    });
  }

  return Promise.resolve();
};

_checkArgs()
  .then(() => _preload())
  .then(() => _load())
  .then(({
    key,
    userDb,
  }) => _listenLibs({key, userDb})
    .then(() => _lockArchae())
    .then(() => _listenArchae())
    .then(() => _boot({key}))
    .then(() => {
      if (flags.site) {
        console.log('Site: ' + config.metadata.site.url + '/');
      }
      if (flags.home) {
        console.log('Home: ' + config.metadata.home.url + '/');
      }
      if (flags.hub) {
        console.log('Hub: ' + config.metadata.hub.url + '/');
      }
      if (flags.server) {
        console.log('Server: ' + config.metadata.server.url + '/');
      }
    })
    .then(() => _launch())
  )
  .catch(err => {
    console.warn(err);

    process.exit(1);
  });
