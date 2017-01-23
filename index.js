const archae = require('archae');

const args = process.argv.slice(2);
const mode = args.includes('--site') ? 'site' : 'app';

const a = archae({
  dirname: __dirname,
  hostname: 'zeo.sh',
  port: 8000,
  publicDirectory: 'public',
  dataDirectory: 'data',
  staticSite: mode === 'site',
});
if (mode === 'site') {
  require('./lib/site')(a)
} else if (mode === 'app') {
  require('./lib/app')(a);
}
a.listen(err => {
  if (!err) {
    console.log('listening in ' + mode.toUpperCase() + ' mode');
    console.log('https://zeo.sh:8000/');
  } else {
    console.warn(err);
  }
});
