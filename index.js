#!/usr/bin/env node

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
  forum: args.includes('forum'),
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
  siteUrl: _findArg('siteUrl'),
  hubUrl: _findArg('hubUrl'),
  homeUrl: _findArg('homeUrl'),
  vridUrl: _findArg('vridUrl'),
  forumUrl: _findArg('forumUrl'),
  maxUsers: _findArg('maxUsers'),
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
const siteUrl = flags.siteUrl || (protocolString + '://' + hostname + ':' + port);
const hubUrl = flags.hubUrl || (protocolString + '://hub.' + hostname + ':' + port);
const homeUrl = flags.homeUrl || (protocolString + '://127.0.0.1:' + port);
const vridUrl = flags.vridUrl || (protocolString + '://.' + hostname + ':' + port);
const forumUrl = flags.forumUrl || (protocolString + '://forum.' + hostname + ':' + port);
const fullUrl = protocolString + '://127.0.0.1:' + port;
const maxUsers = (flags.maxUsers && parseInt(flags.maxUsers, 10)) || 4;
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
  corsOrigin: fullUrl,
  staticSite: staticSite,
  metadata: {
    config: {
      dataDirectorySrc: dataDirectorySrc,
      cryptoDirectorySrc: cryptoDirectorySrc,
      installDirectorySrc: installDirectorySrc,
    },
    site: {
      url: siteUrl,
      enabled: flags.site,
    },
    home: {
      url: homeUrl,
      enabled: flags.home,
    },
    vrid: {
      url: vridUrl,
    },
    hub: {
      url: hubUrl,
      enabled: flags.hub,
    },
    forum: {
      url: forumUrl,
      enabled: flags.forum,
    },
    server: {
      url: fullUrl,
      worldname: worldname,
      enabled: flags.server,
    },
    maxUsers: maxUsers,
    transient: {},
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

const _configure = () => {
  [process.stdout, process.stderr].forEach(stream => {
    stream.setMaxListeners(100);
  });

  return Promise.resolve();
};

const _preload = () => {
  if (flags.hub || flags.home || flags.server) {
    const preload = require('./lib/preload');
    return preload.preload(a, config);
  } else {
    return Promise.resolve();
  }
};

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
    .then(files => _filterDirectories(_flatten(files)))
    .then(directories => directories.map(directory => directory.slice(config.dirname.length)));
};

const _listenLibs = () => {
  const listenPromises = [];

  if (flags.site) {
    const site = require('./lib/site');
    listenPromises.push(site.listen(a, config));
  }
  if (flags.home) {
    const home = require('./lib/home');
    listenPromises.push(home.listen(a, config));
  }
  if (flags.hub) {
    const hub = require('./lib/hub');
    listenPromises.push(hub.listen(a, config));
  }
  if (flags.server) {
    const server = require('./lib/server');
    listenPromises.push(server.listen(a, config));
  }

  return Promise.all(listenPromises);
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

const _boot = () => {
  const bootPromises = [];

  if (flags.hub || flags.server) {
    bootPromises.push(
      _getAllPlugins()
        .then(plugins => a.requestPlugins(plugins))
    );
  }

  return Promise.all(bootPromises);
};

_checkArgs()
  .then(() => _configure())
  .then(() => _preload())
  .then(() => _install())
  .then(() => _listenLibs())
  .then(() => _listenArchae())
  .then(() => _boot())
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
  .catch(err => {
    console.warn(err);

    process.exit(1);
  });
