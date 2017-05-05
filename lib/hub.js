const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const LRU = require('lru-cache');
const ipAddress = require('ip-address');

const SERVER_EXPIRY_INTERVAL = 60 * 1000;

const listen = (a, config) => {
  const {dirname, dataDirectory, secure} = a;
  const {
    metadata: {
      home: {
        url: homeUrl,
      },
      hub: {
        url: hubUrl,
      },
      my: {
        enabled: myEnabled,
      },
    },
  } = config;

  const serversCache = new LRU({
    maxAge: SERVER_EXPIRY_INTERVAL,
  });
  const _ip6To4 = ip6 => new ipAddress.Address6(ip6).to4().address;
  // const _ip4To6 = ip4 => '::ffff:' + ip4;

  const _listenServers = () => new Promise((accept, reject) => {
    class Server {
      constructor(worldname, url, protocol, port, users, running, address, timestamp) {
        this.worldname = worldname;
        this.url = url;
        this.protocol = protocol;
        this.port = port;
        this.users = users;
        this.running = running;
        this.address = address;
        this.timestamp = timestamp;
      }
    }

    const _getServers = () => serversCache.keys()
      .map(k => serversCache.get(k))
      .filter(v => v !== undefined)
      .sort((a, b) => b.timestamp - a.timestamp);

    a.app.get('/servers/server.json', (req, res, next) => {
      res.json({
        type: 'hub',
        url: null,
      });
    });
    a.app.get('/servers/servers.json', (req, res, next) => {
      res.set('Access-Control-Allow-Origin', '*');

      res.json({
        servers: _getServers(),
      });
    });
    a.app.post('/servers/announce', bodyParserJson, (req, res, next) => {
      const {body: j} = req;

      const _isValidProtocol = s => /^https?$/.test(s);

      if (
        typeof j == 'object' && j !== null &&
        typeof j.worldname === 'string' &&
        typeof j.protocol === 'string' && _isValidProtocol(j.protocol) &&
        typeof j.port === 'number' &&
        Array.isArray(j.users) && j.users.every(user => typeof user === 'string')
      ) {
        const address = (() => {
          const {remoteAddress, remoteFamily} = req.connection;

          if (remoteFamily === 'IPv4') {
            return remoteAddress;
          } else if (remoteFamily === 'IPv6') {
            return _ip6To4(remoteAddress);
          } else {
            return null;
          }
        })();

        if (address) {
          const {worldname, protocol, port, users} = j;
          const url = protocol + '://' + address + ':' + port;
          const running = true;
          const timestamp = Date.now();

          const server = new Server(worldname, url, protocol, port, users, running, address, timestamp);
          serversCache.set(url, server);

          res.send();

          console.log('server announce', JSON.stringify([worldname, address, protocol, port, url]));
        } else {
          res.status(400);
          res.send();
        }
      } else {
        res.status(400);
        res.send();
      }
    });

    accept();
  });

  return Promise.all([
    _listenServers(),
  ])
  .then(() => {});
};

module.exports = {
  listen,
};
