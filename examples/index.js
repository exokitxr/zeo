const archae = require('archae');

const server = http.createServer(app);

const a = archae();
a.listen(server);

server.listen(8000);
server.on('listening', () => {
  console.log('listening');
});
server.on('error', err => {
  console.warn(err);
});
