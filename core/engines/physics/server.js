const path = require('path');
const child_process = require('child_process');

const OPEN = 1; // ws.OPEN

class Physics {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {wss} = archae.getCore();
    const {
      metadata: {
        site: {
          url: siteUrl,
        },
        server: {
          url: serverUrl,
        },
      },
    } = archae;

    const worker = child_process.fork(path.join(__dirname, 'worker.js'));
    worker.on('message', m => {
      const [n] = m;
      const interest = interests[n];

      if (interest && interest.length > 0) {
        const ms = JSON.stringify(m);
        
        for (let i = 0; i < connections.length; i++) {
          const connection = connections[i];

          if (interest.includes(connection.userId) && connection.readyState === OPEN) {
            connection.send(ms);
          }
        }
      }
    });
    worker.on('error', err => {
      console.warn(err);
    });
    worker.on('exit', code => {
      console.warn('physics worker exited with code', code);

      process.exit(1);
    });

    const _parseUrlSpec = url => {
      const match = url.match(/^(?:([^:]+):\/\/)([^:]+)(?::([0-9]*?))?$/);
      return match && {
        protocol: match[1],
        host: match[2],
        port: match[3] ? parseInt(match[3], 10) : null,
      };
    };
    const siteSpec = _parseUrlSpec(siteUrl);
    const serverSpec = _parseUrlSpec(serverUrl);

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    const interests = {};

    const connections = [];
    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/\/archae\/physicsWs\?id=(.+)$/)) {
        const userId = match[1];
        c.userId = userId;

        const localInterests = [];

        c.on('message', m => {
          const j = JSON.parse(m);
          worker.send(j);

          const {method} = j;
          switch (method) {
            case 'add': {
              const {args} = j;
              const [n] = args;

              let interest = interests[n];
              if (!interest) {
                interest = [];
                interests[n] = interest;
              }
              interest.push(userId);

              localInterests.push(n);
              break;
            }
            case 'remove': {
              const {args} = j;
              const [n] = args;

              const interest = interests[n];
              if (interest) {
                interest.splice(interest.indexOf(userId), 1);
                if (interest.length === 0) {
                  delete interests[n];
                }
              }

              const localInterestIndex = localInterests.indexOf(n);
              if (localInterestIndex !== -1) {
                localInterests.splice(localInterestIndex, 1);
              }
              break;
            }
          }
        });

        connections.push(c);

        c.on('close', () => {
          worker.send({
            method: 'removeOwner',
            args: [userId],
          });

          for (let i = 0; i < localInterests.length; i++) {
            const n = localInterests[i];
            const interest = interests[n];

            interest.splice(interest.indexOf(userId), 1);
            if (interest.length === 0) {
              delete interests[n];
            }
          }

          connections.splice(connections.indexOf(c), 1);
        });
      }
    });
    this._cleanup = () => {
      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.close();
      }
    };
  }

  unmount() {
    this._cleanup();
  }
}

const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = Physics;
