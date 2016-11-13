const path = require('path');
const mkdirp = require('mkdirp');

const nedb = require('nedb');
const nedbModel = require('nedb/lib/model');

const OPEN = 1; // ws.OPEN

class Subscription {
  constructor({id, query, database, connection}) {
    this.id = id;
    this.query = query;
    this.database = database;
    this.connection = connection;

    this._live = true;
    this._lastValue = null;
  }

  update() {
    const {query, database} = this;

    database.findOne(query, (err, result) => {
      const {_live: live} = this;

      if (live) {
        if (!err) {
          const {_lastValue: lastValue} = this;

          if (!nedbModel.areThingsEqual(result, lastValue)) {
            const {id, connection} = this;
            const e = {
              id: id,
              data: result,
            };
            const es = JSON.stringify(e);
            c.send(es);

            this._lastValue = result;
          }
        } else {
          console.warn(err);
        }
      }
    });
  }

  destroy() {
    this._live = false;
  }
}

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
                let subscriptions = [];

                const _updateSubscriptions = () => {
                  for (let i = 0; i < subscriptions.length; i++) {
                    const subscription = subscriptions[i];
                    subscription.update();
                  }
                };
                const _filterSubscriptions = predicate => {
                  const liveSubscriptions = [];

                  for (let i = 0; i < subscriptions.length; i++) {
                    const subscription = subscriptions[i];
                    if (predicate(subscription)) {
                      liveSubscriptions.push(subscription);
                    } else {
                      subscription.destroy();
                    }
                  }

                  subscriptions = liveSubscriptions;
                };

                wss.on('connection', c => {
                  const {url} = c.upgradeReq;

                  if (url === '/archae/nedbWs') {
                    let connectionSubscriptionIds = [];

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
                          db[method](...args, (err, result) => {
                            if (!err) {
                              cb(err);
                            } else {
                              cb(null, result);

                              if (method === 'insert' || method === 'update' || method === 'remove') {
                                _updateSubscriptions();
                              }
                            }
                          });
                        } else if (method === 'subscribe') {
                          const [query, subscriptionId] = args;

                          const subscription = new Subscription({
                            id: subscriptionId,
                            query,
                            database: db,
                            connection: c,
                          });
                          subscriptions.push(subscription);
                          connectionSubscriptionIds.push(subscriptionId);
                        } else if (method === 'unsubscribe') {
                          const [subscriptionId] = args;

                          _filterSubscriptions(subscription => subscription.id !== subscriptionId);
                          connectionSubscriptionIds = connectionSubscriptionIds.filter(connectionSubscriptionId => connectionSubscriptionId !== subscriptionId);
                        } else {
                          const err = new Error('no such method:' + JSON.stringify(method));
                          cb(err.stack);
                        }
                      }
                    });
                    c.on('close', () => {
                      connections.splice(connections.indexOf(c), 1);

                      if (connectionSubscriptionIds.length > 0) {
                        _filterSubscriptions(subscription => !connectionSubscriptionIds.includes(subscription.id));
                      }
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
