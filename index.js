const path = require('path');
const fs = require('fs');

const archae = require('archae');

const args = process.argv.slice(2);
const flags = {
  server: args.includes('server'),
  site: args.includes('site'),
  hub: args.includes('hub'),
  install: args.includes('install'),
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
  username: (() => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const match = arg.match(/^username=(.+)$/);
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

const hostname = flags.host || 'zeovr.io';
const port = flags.port || 8000;
const serverHost = flags.serverHost || ('server.' + hostname);
const config = {
  dirname: __dirname,
  hostname: hostname,
  port: port,
  publicDirectory: 'public',
  dataDirectory: 'data',
  installDirectory: 'installed',
  // staticSite: flags.site, // XXX remove this option from archae
  metadata: {
    site: {
      hostname: hostname,
      port: port,
      url: hostname + ':' + port,
    },
    hub: {
      hostname: 'hub.' + hostname,
      port: port,
      url: 'hub.' + hostname + ':' + port,
    },
    server: {
      hostname: serverHost,
      port: port,
      url: serverHost + ':' + port,
    },
    current: {
      url: serverHost + ':' + port,
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
        fs.lstat(file, (err, stats) => {
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
        .then(directories => a.installPlugins(directories.map(directory => directory.slice(config.dirname.length))))
      );
  } else {
    return Promise.resolve();
  }
}

const _listen = () => {
  const listenPromises = [];

  if (flags.site) {
    const site = require('./lib/site');
    listenPromises.push(site.listen(a, config));
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

_install()
  .then(() => _listen())
  .then(() => new Promise((accept, reject) => {
    const flagList = (() => {
      const result = [];
      for (const k in flags) {
        if (flags[k]) {
          result.push(k);
        }
      }
      return result;
    })();

    console.log('modes:', JSON.stringify(flagList));

    if (flags.site || flags.hub || flags.server) {
      a.listen(err => {
        if (!err) {
          if (flags.site) {
            console.log('https://' + config.metadata.site.url + '/');
          }
          if (flags.hub) {
            console.log('https://' + config.metadata.hub.url + '/');
          }
          if (flags.server) {
            console.log('https://' + config.metadata.server.url + '/');
          }
        } else {
          console.warn(err);
        }
      });
    }
  }))
  .catch(err => {
    console.warn(err);

    process.exit(1);
  });
