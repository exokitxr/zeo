const path = require('path');
const fs = require('fs');

const archae = require('archae');

const args = process.argv.slice(2);
const flags = {
  app: args.includes('app'),
  site: args.includes('site'),
  hub: args.includes('hub'),
  start: args.includes('start'),
  stop: args.includes('stop'),
  reboot: args.includes('reboot'),
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
};
const hasFlag = (() => {
  for (const k in flags) {
    if (flags[k]) {
      return true;
    }
  }
  return false;
})();
if (!hasFlag) {
  flags.app = true;
}

const config = {
  dirname: __dirname,
  hostname: flags.host || 'zeovr.io',
  port: flags.port || 8000,
  publicDirectory: 'public',
  dataDirectory: 'data',
  staticSite: flags.site,
  metadata: {
    hub: {
      url: flags.hubUrl || 'zeovr.io',
      numContainers: 10,
      startPort: 9000,
      enabled: Boolean(flags.hub || flags.hubUrl),
    },
  },
};
const a = archae(config);

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

const _stop = () => {
  const stopPromises = [];
  if (flags.stop || flags.reboot) {
    stopPromises.push(require('./lib/hub').stop(a, config));
  }

  return Promise.all(stopPromises);
};

const _start = () => {
  const startPromises = [];

  if (flags.start || flags.reboot) {
    const hub = require('./lib/hub');
    const promise = hub.check(a, config)
      .then(() => hub.start(a, config))
    startPromises.push(promise);
  }

  return Promise.all(startPromises);
};

const _listen = () => {
  const listenPromises = [];

  if (flags.app) {
    const app = require('./lib/app');
    listenPromises.push(app.listen(a, config));
  }
  if (flags.site) {
    const site = require('./lib/site');
    listenPromises.push(site.listen(a, config));
  }
  if (flags.hub) {
    const hub = require('./lib/hub');
    listenPromises.push(hub.listen(a, config));
  }

  return Promise.all(listenPromises);
};

_install()
  .then(() => _stop())
  .then(() => _start())
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

    if (flags.app || flags.site) {
      a.listen(err => {
        if (!err) {
          console.log('https://' + config.hostname + ':' + config.port + '/');
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
