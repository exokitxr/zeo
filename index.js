const archae = require('archae');

const args = process.argv.slice(2);
const flags = {
  app: args.includes('app'),
  site: args.includes('site'),
  start: args.includes('start'),
  stop: args.includes('stop'),
  reboot: args.includes('reboot'),
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

const a = archae({
  dirname: __dirname,
  hostname: 'zeo.sh',
  port: 8000,
  publicDirectory: 'public',
  dataDirectory: 'data',
  staticSite: flags.site,
});

const _stop = () => {
  const stopPromises = [];
  if (flags.stop || flags.reboot) {
    stopPromises.push(require('./lib/hub').stop(a));
  }

  return Promise.all(stopPromises);
};

const _start = () => {
  const startPromises = [];
  if (flags.app) {
    startPromises.push(require('./lib/app')(a));
  }
  if (flags.site) {
    startPromises.push(require('./lib/site')(a));
  }
  if (flags.start || flags.reboot) {
    const hub = require('./lib/hub');
    const promise = hub.check(a)
      .then(() => hub.start(a));
    startPromises.push(promise);
  }

  return Promise.all(startPromises);
};

_stop()
  .then(() => _start())
  .then(() => {
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
          a.close();
        }
      });
    }
  })
  .catch(err => {
    console.warn(err);

    process.exit(1);
  });
