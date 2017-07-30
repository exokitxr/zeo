const events = require('events');
const {EventEmitter} = events;

const TIMEOUT = 30 * 1000;

class Wallet {
constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {wss} = archae.getCore();

    const trackedTags = {};

    class TrackedTag extends EventEmitter {
      constructor() {
        super();

        this._timeout = null;

        this.listen();
      }

      listen() {
        this._timeout = setTimeout(() => {
          this.emit('timeout');
        }, TIMEOUT);
      }

      kick() {
        if (this._timeout) {
          clearTimeout(this._timeout);
          this._timeout = null;
        }
      }

      unkick() {
        if (!this.timeout) {
          this.listen();
        }
      }

      destroy() {
        if (this._timeout) {
          clearTimeout(this._timeout);
        }
      }
    }

    const connections = [];
    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      if (url === '/archae/walletWs') {
        c.on('message', s => {
          const m = _jsonParse(s);

          if (typeof m === 'object' && m !== null && typeof m.method === 'string' && Array.isArray(m.args)) {
            const {method, args} = m;

            if (method === 'kickAsset') {
              /* const [id] = args;
              const trackedTag = trackedTags[id];

              if (trackedTag) {
                trackedTag.kick();
              } */
            } else if (method === 'unkickAsset') {
              /* const [id] = args;
              const trackedTag = trackedTags[id];

              if (trackedTag) {
                trackedTag.unkick();
              } */
            } else {
              console.warn('no such method:' + JSON.stringify(method));
            }
          } else {
            console.warn('invalid message', m);
          }
        });
        c.on('close', () => {
          connections.splice(connections.indexOf(c), 1);
        });

        connections.push(c);
      }
    });

    const _bindTag = tag => { 
      const {id} = tag;
      const timestamp = Date.now();
      const trackedTag = new TrackedTag();
      trackedTag.on('timeout', () => {
        walletApi.emit('removeTag', id);
      });
      trackedTags[id] = trackedTag;
    };
    const _unbindTag = tagSpec => {
      const {id} = tagSpec;
      const trackedTag = trackedTags[id];
      trackedTag.destroy();
      delete trackedTags[id];
    };

    this._cleanup = () => {
      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.close();
      }
    };

    class WalletApi extends EventEmitter {
      addAsset(tagSpec) {
        _bindTag(tagSpec);
      }

      removeAsset(tagSpec) {
        _unbindTag(tagSpec);
      }

    }
    const walletApi = new WalletApi();

    return walletApi;
  }

  unmount() {
    this._cleanup();
  }
}
const _jsonParse = s => {
  let error = null;
  let result;
  try {
    result = JSON.parse(s);
  } catch (err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return null;
  }
};

module.exports = Wallet;
