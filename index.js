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
  hostname: 'zeo.sh',
  port: 8000,
  publicDirectory: 'public',
  dataDirectory: 'data',
  staticSite: flags.site,
  hub: {
    numContainers: 10,
    startPort: 9000,
  },
};
const a = archae(config);

const _install = () => {
  if (flags.install) {
    return a.requestPlugin('/core/engines/zeo')
      .then(() => {});
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
  if (flags.app) {
    const app = require('./lib/app');
    startPromises.push(app.listen(a, config));
  }
  if (flags.site) {
    const site = require('./lib/site');
    startPromises.push(site.listen(a, config));
  }
  if (flags.hub) {
    const hub = require('./lib/hub');
    startPromises.push(hub.listen(a, config));
  }
  if (flags.start || flags.reboot) {
    const hub = require('./lib/hub');
    const promise = hub.check(a, config)
      .then(() => hub.start(a, config))
    startPromises.push(promise);
  }

  return Promise.all(startPromises);
};

_install()
  .then(() => _stop())
  .then(() => _start())
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
          console.log('https://zeo.sh:8000/');
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
