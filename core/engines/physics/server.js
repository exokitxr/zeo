const path = require('path');
const child_process = require('child_process');

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
      if (connections.length > 0) {
        const ms = JSON.stringify(m);
        
        for (let i = 0; i < connections.length; i++) {
          const connection = connections[i];
          connection.send(ms);
        }
      }
    });
    worker.on('error', err => {
      console.warn(err);
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

    const connections = [];
    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/\/archae\/physicsWs\?id=(.+)$/)) {
        const userId = match[1];

        c.on('message', m => {
          const j = JSON.parse(m);
          worker.send(j);
        });

        connections.push(c);

        c.on('close', () => {
          worker.send({
            method: 'removeOwner',
            args: [userId],
          });

          connections.splice(connections.indexOf(c), 1);
        });

        worker.send({
          method: 'clearCache',
          args: [],
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
