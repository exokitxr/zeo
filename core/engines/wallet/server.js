const events = require('events');
const {EventEmitter} = events;

class Wallet {
constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {ws, wss} = archae.getCore();

    class AssetInstance {
      constructor(id, type, assetId, name, ext, path, attributes, icon, n, physics, matrix, open) {
        this.id = id;
        this.type = type;
        this.assetId = assetId;
        this.name = name;
        this.ext = ext;
        this.path = path;
        this.attributes = attributes;
        this.icon = icon;
        this.n = n;
        this.physics = physics;
        this.matrix = matrix;
        this.open = open;
      }
    }

    const assetInstances = [];

    const connections = [];
    wss.on('connection', (c, {url}) => {
      if (url === '/archae/walletWs') {
        const _init = () => {
          c.send(JSON.stringify({
            type: 'init',
            args: {
              assets: assetInstances,
            }
          }));
        };
        _init();

        const _broadcast = m => {
          for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];
            if (connection.readyState === ws.OPEN && connection !== c) {
              connection.send(m);
            }
          };
        };

        c.on('message', s => {
          const m = _jsonParse(s);
          const {method, args} = m;

          if (method === 'addAsset') {
            const {id, type, assetId, name, ext, path, attributes, icon, n, physics, matrix, open} = args;
            const assetInstance = new AssetInstance(id, type, assetId, name, ext, path, attributes, icon, n, physics, matrix, open);
            assetInstances.push(assetInstance);

            _broadcast(JSON.stringify({type: 'addAsset', args: {id, type, assetId, name, ext, path, attributes, icon, n, physics, matrix, open}}));
          } else if (method === 'removeAsset') {
            const {id} = args;
            assetInstances.splice(assetInstances.findIndex(assetInstance => assetInstance.id === id), 1);

            _broadcast(JSON.stringify({type: 'removeAsset', args: {id}}));
          } else if (method === 'setOpen') {
            const {id, open} = args;
            const assetInstance = assetInstances.find(assetInstance => assetInstance.id === id);

            if (assetInstance) {
              assetInstance.open = open;

              _broadcast(JSON.stringify({type: 'setOpen', args: {id, open}}));
            }
          } else if (method === 'setPhysics') {
            const {id, physics} = args;
            const assetInstance = assetInstances.find(assetInstance => assetInstance.id === id);

            if (assetInstance) {
              assetInstance.physics = physics;

              _broadcast(JSON.stringify({type: 'setPhysics', args: {id, physics}}));
            }
          } else {
            console.warn('no such method:' + JSON.stringify(method));
          }
        });
        c.on('close', () => {
          connections.splice(connections.indexOf(c), 1);
        });

        connections.push(c);
      }
    });
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
