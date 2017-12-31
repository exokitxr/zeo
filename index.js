#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const http = require('http');
const child_process = require('child_process');

const archae = require('archae');
const rimraf = require('rimraf');
const requireRelative = require('require-relative');

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
  name: _findArg('name'),
  pluginsDirectory: _findArg('pluginsDirectory'),
  dataDirectory: _findArg('dataDirectory'),
  cryptoDirectory: _findArg('cryptoDirectory'),
  installDirectory: _findArg('installDirectory'),
  defaultsDirectory: _findArg('defaultsDirectory'),
  siteUrl: _findArg('siteUrl'),
  vridUrl: _findArg('vridUrl'),
  crdsUrl: _findArg('crdsUrl'),
  noTty: args.includes('noTty'),
  offline: args.includes('offline'),
  bundle: args.includes('bundle'),
  sw: args.includes('sw'),
  maxUsers: _findArg('maxUsers'),
};
if (!flags.server && !flags.install && !flags.bundle) {
  flags.server = true;
}

const hostname = flags.host || 'zeovr.io';
const port = flags.port || 8000;
const secure = (typeof flags.secure === 'boolean') ? flags.secure : false;
const dataDirectory = flags.dataDirectory || 'data';
const cryptoDirectory = flags.cryptoDirectory || 'crypto';
const installDirectory = flags.installDirectory || 'data/installed';
const defaultsDirectory = flags.defaultsDirectory || 'defaults';
const password = (() => {
  try {
    const worldConfigJsonPath = path.join(__dirname, dataDirectory, 'world', 'config.json');
    const s = fs.readFileSync(worldConfigJsonPath, 'utf8');
    const j = JSON.parse(s);

    if (j && (j.password === null || typeof j.password === 'string')) {
      return j.password;
    } else {
      return null;
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    } else {
      throw err;
    }
  }
})();
const hotload = (() => {
  try {
    const noHotloadJsonPath = path.join(__dirname, dataDirectory, 'no-hotload.json');
    return !fs.existsSync(noHotloadJsonPath, 'utf8');
  } catch (err) {
    return false;
  }
})();
const protocolString = !secure ? 'http' : 'https';
const siteUrl = flags.siteUrl || (protocolString + '://' + hostname + ':' + port);
const vridUrl = flags.vridUrl || (protocolString + '://' + hostname + ':' + port);
const crdsUrl = flags.crdsUrl || (protocolString + '://' + hostname + ':' + port);
const fullUrl = protocolString + '://127.0.0.1:' + port;
const indexJsPrefix = `window.startTime = ${Date.now()};\n` + (flags.offline ? `\
(() => {
  const query = {};
  window.location.search.replace(
    /([^?=&]+)(=([^&]*))?/g,
    ($0, $1, $2, $3) => {
      query[$1] = $3;
    }
  );
  const {t} = query;
  window.metadata.offlinePlugins = t ?
    t
      .split(',')
      .map(p => {
        const match = decodeURIComponent(p).match(/^(.+?)(?:@(.+?))?$/);
        return match && {
          name: match[1],
          version: match[2] || '',
        };
      })
      .filter(p => p !== null)
  : [];
})();
` : '');
const serverName = flags.name || 'Server';
const maxUsers = (flags.maxUsers && parseInt(flags.maxUsers, 10)) || 4;
const config = {
  dirname: __dirname,
  hostname,
  port,
  secure,
  hotload,
  publicDirectory: 'public',
  dataDirectory,
  cryptoDirectory,
  installDirectory,
  indexJsPrefix,
  indexJsFiles: [
    path.join(__dirname, 'public', 'js', 'index.js'),
  ],
  password,
  cors: true,
  offline: flags.offline,
  staticSite: flags.offline,
  metadata: {
    config: {
      defaultsDirectory,
    },
    /* site: {
      url: siteUrl,
    },
    vrid: {
      url: vridUrl,
    },
    crds: {
      url: crdsUrl,
    }, */
    server: {
      url: fullUrl,
      name: serverName,
      enabled: flags.server,
    },
    protocolString,
    port,
    password,
    maxUsers,
    noTty: flags.noTty,
    offline: flags.offline,
    offlinePlugins: [],
    transient: {},
  },
};
const a = archae(config);

const _preload = () => {
  if (flags.server) {
    const preload = require('./lib/preload');
    return preload.preload(a, config);
  } else {
    return Promise.resolve();
  }
};

const _install = () => {
  if (flags.install) {
    return _getPlugins({core: true, def: true})
      .then(plugins => a.installPlugins(plugins));
  } else {
    return Promise.resolve();
  }
};

const _configure = () => {
  [process.stdout, process.stderr].forEach(stream => {
    stream.setMaxListeners(100);
  });

  if (flags.offline) {
    return _getPlugins({core: true})
      .then(plugins => {
        a.offlinePlugins = plugins;
      });
  } else {
    return Promise.resolve();
  }
};

const _getPlugins = ({core = false, def = false} = {}) => {
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
        const decoratedFiles = files.map(file => p + '/' + file);
        accept(decoratedFiles);
      } else {
        reject(err);
      }
    });
  });
  const _readTagsJsonModules = p => new Promise((accept, reject) => {
    fs.readFile(p, 'utf8', (err, s) => {
      if (!err) {
        const j = JSON.parse(s);
        const {tags} = j;

        const modules = [];
        for (const id in tags) {
          const tagSpec = tags[id];

          if (tagSpec.type === 'entity') {
            modules.push(tagSpec.module);
          }
        }
        accept(modules);
      } else {
        reject(err);
      }
    });
  });

  // NOTE: this cannot be path.join() because Windows
  return Promise.all(
    (core ?
      [
        config.dirname + '/core/engines',
        config.dirname + '/core/utils',
      ].map(_readdir)
    :
      []
    ).concat(
      def ? _readTagsJsonModules(config.dirname + '/defaults/world/tags.json') : []
    )
  )
    .then(files => _flatten(files))
    .then(directories => directories.map(directory => directory.replace(config.dirname, '')));
};

const _listenLibs = () => {
  const listenPromises = [];

  if (flags.server) {
    const server = require('./lib/server');
    listenPromises.push(server.listen(a, config));
  }

  return Promise.all(listenPromises);
};

const _listenArchae = () => {
  if (flags.server) {
    const _listenOffline = () => {
      if (flags.offline) {
        a.app.post('/build/:mod', (req, res, next) => {
          a.requestPlugin(req.params.mod, {offline: true})
            .then(() => {
              res.json({});
            })
            .catch(err => {
              res.status(500);
              res.json({
                error: err.stack,
              });
            });
        });
        a.app.get(/^\/build\/([^\/]+?)\/(.+)\.js$/, (req, res, next) => {
          res.set('Cache-Control', 'max-age=60, public');

          const {params} = req;
          const mod = params[0];
          const target = params[1];

          if (mod === target) {
            a.requestPluginBundle(mod)
              .then(codeString => {
                if (codeString !== null) {
                  res.type('application/javascript');
                  res.end(codeString);
                } else {
                  res.status(404);
                  res.end(http.STATUS_CODES[404] + '\n');
                }
              })
              .catch(err => {
                res.status(500);
                res.end(err.stack);
              });
          } else {
            res.status(404);
            res.end(http.STATUS_CODES[404] + '\n');
          }
        });
        a.app.get(/^\/build\/([^\/]+?)\/serve\/(.+)\.js$/, (req, res, next) => {
          res.set('Cache-Control', 'max-age=60, public');

          const {params} = req;
          const mod = params[0];
          const serve = params[1];

          if (mod === target) {
            a.requestPluginServe(mod, serve)
              .then(d => {
                if (d !== null) {
                  res.type(serve);
                  res.end(d);
                } else {
                  res.status(404);
                  res.end(http.STATUS_CODES[404] + '\n');
                }
              })
              .catch(err => {
                res.status(500);
                res.end(err.stack);
              });
          } else {
            res.status(404);
            res.end(http.STATUS_CODES[404] + '\n');
          }
        });
        a.app.get(/^\/build\/([^\/]+?)\/build\/(.+)\.js$/, (req, res, next) => {
          res.set('Cache-Control', 'max-age=60, public');

          const {params} = req;
          const mod = params[0];
          const build = params[1];

          if (mod === target) {
            a.requestPluginBuild(mod, build)
              .then(d => {
                if (d !== null) {
                  res.type('application/javascript');
                  res.end(d);
                } else {
                  res.status(404);
                  res.end(http.STATUS_CODES[404] + '\n');
                }
              })
              .catch(err => {
                res.status(500);
                res.end(err.stack);
              });
          } else {
            res.status(404);
            res.end(http.STATUS_CODES[404] + '\n');
          }
        });

        a.ensurePublicBundlePromise();
        return a.publicBundlePromise
          .then(() => {});
      } else {
        return Promise.resolve();
      }
    };

    return _listenOffline()
      .then(() => new Promise((accept, reject) => {
        a.listen(err => {
          if (!err) {
            accept();
          } else {
            reject(err);
          }
        });
      }));
  } else {
    return Promise.resolve();
  }
};

const _listenNetwork = () => {
  const listenPromises = [];

  if (flags.server && !flags.offline) {
    const server = require('./lib/network');
    listenPromises.push(server.listen(a, config));
  }

  return Promise.all(listenPromises);
};

const _boot = () => {
  const bootPromises = [];

  if (flags.server) {
    if (!flags.offline) {
      bootPromises.push(
        _getPlugins({core: true})
          .then(plugins => a.requestPlugins(plugins))
      );
    } else {
      console.log('Local URL: ' + fullUrl);
    }
  }
  if (flags.bundle) {
    a.ensurePublicBundlePromise();
    a.publicBundlePromise
      .then(bundle => {
        process.stdout.write(bundle.toString());
      });
  }

  return Promise.all(bootPromises);
};

_configure()
  .then(() => _preload())
  .then(() => _install())
  .then(() => _listenLibs())
  .then(() => _listenArchae())
  .then(() => _listenNetwork())
  .then(() => _boot())
  .catch(err => {
    console.warn(err);
    process.exit(1);
  });
