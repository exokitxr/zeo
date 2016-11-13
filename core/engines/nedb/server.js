const path = require('path');
const mkdirp = require('mkdirp');

const nedb = require('nedb');

const OPEN = 1; // ws.OPEN

const server = ({wss, dirname}) => ({
  mount() {
    const db = new nedb({
      filename: path.join(dirname, 'data', 'nedb.db'),
    });

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    mkdirp(path.join(dirname, 'data'), err => {
      if (live) {
        if (!err) {
          db.loadDatabase(err => {
            if (live) {
              if (!err) {
                const connections = [];

                wss.on('connection', c => {
                  const {url} = c.upgradeReq;

                  if (url === '/archae/nedbWs') {
                    c.on('message', s => {
                      const m = JSON.parse(s);
                      if (typeof m === 'object' && m && typeof m.method === 'string' && typeof m.id === 'string' && Array.isArray(m.args)) {
                        const {method, id, args} = m;

                        const cb = (err = null, result = null) => {
                            if (c.readyState === OPEN) {
                              const e = {
                                id: id,
                                error: err,
                                result: result,
                              };
                              const es = JSON.stringify(e);
                              c.send(es);
                            }
                          };

                        if (
                            method === 'insert' ||
                            method === 'find' ||
                            method === 'findOne' ||
                            method === 'update' ||
                            method === 'remove' ||
                            method === 'ensureIndex' ||
                            method === 'removeIndex'
                        ) {
                          db[method](...args, cb);
                        } else if (method === 'subscribe') {
                          const [query, subscriptionId] = args;
                          // XXX implement subscription tracking with proper cleanup
                        } else if (method === 'unsubscribe') {
                          const [subscriptionId] = args;
                          // XXX
                        } else {
                          const err = new Error('no such method:' + JSON.stringify(method));
                          cb(err.stack);
                        }
                      }
                    });
                    c.on('close', () => {
                      connections.splice(connections.indexOf(c), 1);
                    });

                    connections.push(c);
                  }
                });

                this._cleanup = () => {
                  for (let i = 0; i < connections.length; i++) {
                    const connection = connections[i];
                    connection.close();
                  }
                  connections = [];
                };
              } else {
                console.warn(err);
              }
            }
          });
        } else {
          console.warn(err);
        }
      }
    });

    return db;
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = server;
