const archae = require('archae');

const args = process.argv.slice(2);
const modes = {
  app: false,
  site: args.includes('--site'),
  hub: args.includes('--hub'),
};
const hasMode = (() => {
  for (const k in modes) {
    if (modes[k]) {
      return true;
    }
  }
  return false;
})();
if (!hasMode) {
  modes.app = true;
}

const a = archae({
  dirname: __dirname,
  hostname: 'zeo.sh',
  port: 8000,
  publicDirectory: 'public',
  dataDirectory: 'data',
  staticSite: modes.site,
});

const modePromises = [];
if (modes.app) {
  modePromises.push(require('./lib/app')(a));
}
if (modes.site) {
  modePromises.push(require('./lib/site')(a));
}
if (modes.hub) {
  modePromises.push(require('./lib/hub')(a));
}

Promise.all(modePromises)
  .then(() => {
    const modeList = (() => {
      const result = [];
      for (const k in modes) {
        if (modes[k]) {
          result.push(k);
        }
      }
      return result;
    })();

    a.listen(err => {
      if (!err) {
        console.log('listening:', JSON.stringify(modeList));
        console.log('https://zeo.sh:8000/');
      } else {
        console.warn(err);
      }
    });
  })
  .catch(err => {
    console.warn(err);

    process.exit(1);
  });
