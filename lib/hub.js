const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const LRU = require('lru-cache');
const ipAddress = require('ip-address');

const auth = require('./auth');

const SERVER_EXPIRY_INTERVAL = 60 * 1000;

// const GOLD_PLAN_ID = 'gold';

const listen = (a, config, {key, userDb}) => {
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

  const _getAuthentication = req => {
    const authorization = req.get('Authorization') || '';
    const match = authorization.match(/^Token (.+)$/);
    return match && match[1];
  };
  const _authenticate = (authentication, cb) => {
    if (authentication) {
      userDb.findOne({
        type: 'token',
        authentication,
      }, (err, t) => {
        if (!err) {
          const username = t ? t.username : null;

          cb(null, username);
        } else {
          cb(err);
        }
      });
    } else {
      process.nextTick(() => {
        cb({
          code: 'EAUTH',
        });
      });
    }
  };

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

  /* const _listenStripe = () => new Promise((accept, reject) => {
    const {dirname, dataDirectory} = a;

    a.app.get('/stripe/publishableKey.json', (req, res, next) => {
      res.json(stripePublishableKey);
    });

    a.app.post('/hub/signUp', bodyParserJson, (req, res, next) => {
      const {body: j} = req;

      if (typeof j == 'object' && j !== null && typeof j.username === 'string' && typeof j.stripeToken === 'string') {
        const {username, stripeToken} = j;

        userDb.findOne({
          type: 'user',
          username,
          plan: null,
        }, (err, user) => {
          if (!err) {
            if (user) {
              console.log('creating customer', JSON.stringify({username}));

              stripe.customers.create({
                description: username,
                source: stripeToken,
              }, (err, customer) => {
                const {id: customerId} = customer;

                console.log('created customer', JSON.stringify({username, customerId}));

                if (!err) {
                  stripe.subscriptions.create({
                    customer: customerId,
                    plan: GOLD_PLAN_ID,
                  }, (err, subscription) => {
                    const {id: subscriptionId} = subscription;

                    console.log('created subscription', JSON.stringify({username, customerId, subscriptionId, plan: GOLD_PLAN_ID}));

                    userDb.update({
                      type: 'user',
                      username,
                    }, {
                      $set: {
                        plan: GOLD_PLAN_ID,
                      }
                    }, err => {
                      if (!err) {
                        console.log('updated user plan', JSON.stringify({username, customerId, subscriptionId, plan: GOLD_PLAN_ID}));

                        res.json({
                          ok: true,
                        });
                      } else {
                        console.warn(err);

                        res.status(500);
                        res.send();
                      }
                    });
                  });
                } else {
                  console.warn(err);

                  res.status(500);
                  res.send();
                }
              });
            } else {
              res.status(400);
              res.send();
            }
          }
        });
      } else {
        res.status(400);
        res.send();
      }
    });

    accept();
  }); */

  return Promise.all([
    _listenServers(),
    // _listenStripe(),
  ])
  .then(() => {});
};

module.exports = {
  listen,
};
