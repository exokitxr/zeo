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
  a.app.get('/', (req, res, next) => {
    req.url = '/site.html';
    a.app(req, res, next);
  });
} else if (mode === 'app') {
  a.app.get('/', (req, res, next) => {
    req.url = '/vr.html';
    a.app(req, res, next);
  });
}
a.listen(err => {
  if (!err) {
    console.log('listening in ' + mode.toUpperCase() + ' mode');
    console.log('https://zeo.sh:8000/');
  } else {
    console.warn(err);
  }
});
