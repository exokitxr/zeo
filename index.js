#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
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
  connect: args.includes('connect'),
  install: args.includes('install'),
  reset: args.includes('reset'),
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
  maxUsers: _findArg('maxUsers'),
};
if (!flags.server && !flags.connect && !flags.install && !flags.reset && !flags.bundle) {
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
      .split(',').map(p => {
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
  staticSite: false,
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

const _reset = () => new Promise((accept, reject) => {
  if (flags.reset) {
    rimraf(path.join(dataDirectory, 'world'), err => {
      if (!err) {
        accept();
      } else {
        reject(err);
      }
    });
  } else {
    accept();
  }
});

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

  return Promise.resolve();
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

const _listenNetwork = () => {
  const listenPromises = [];

  if (flags.server) {
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
      bootPromises.push(
        _getPlugins({core: true})
          .then(plugins => {
            a.offlinePlugins = plugins;
          })
      );
    }
  }
  if (flags.connect) {
    const nodeWebvrPath = path.join(requireRelative.resolve('node-webvr', path.join(__dirname, 'scripts', 'lib', 'windows', 'node-webvr')), '..');
    const childProcess = child_process.spawn(path.join(nodeWebvrPath, 'run' + (process.platform === 'win32' ? '.cmd' : '.sh')), [fullUrl + '?e=hmd']);
    childProcess.on('error', err => {
      console.warn(err);
    });
    childProcess.on('exit', code => {
      if (code !== 0) {
        console.warn('Warning: connect process exited with nonzero status code', code);
      }
      process.exit(code);
    });
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
  .then(() => _reset())
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
