const events = require('events');
const {EventEmitter} = events;

class Wallet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {ws, wss} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/analytics',
    ])
      .then(([
        analytics,
      ]) => {
        if (live) {
          class AssetInstance {
            constructor(assetId, id, name, ext, json, file, n, physics, matrix, visible, open) {
              this.assetId = assetId;
              this.id = id;
              this.name = name;
              this.ext = ext;
              this.json = json;
              this.file = file;
              this.n = n;
              this.physics = physics;
              this.matrix = matrix;
              this.visible = visible;
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
                  const {assetId, id, name, ext, json, file, n, physics, matrix, visible, open} = args;
                  const assetInstance = new AssetInstance(assetId, id, name, ext, json, file, n, physics, matrix, visible, open);
                  assetInstances.push(assetInstance);

                  _broadcast(JSON.stringify({type: 'addAsset', args: {assetId, id, name, ext, json, file, n, physics, matrix, visible, open}}));

                  analytics.addFile({id});
                } else if (method === 'removeAsset') {
                  const {assetId} = args;
                  assetInstances.splice(assetInstances.findIndex(assetInstance => assetInstance.assetId === assetId), 1);

                  _broadcast(JSON.stringify({type: 'removeAsset', args: {assetId}}));

                  analytics.removeFile({id});
                } else if (method === 'setAttribute') {
                  const {assetId, name, value} = args;
                  const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

                  if (assetInstance && assetInstance.json && assetInstance.json.data && typeof assetInstance.json.data === 'object') {
                    assetInstance.json.data.attributes[name].value = value;

                    _broadcast(JSON.stringify({type: 'setAttribute', args: {assetId, name, value}}));
                  }
                } else if (method === 'setVisible') {
                  const {assetId, visible} = args;
                  const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

                  if (assetInstance) {
                    assetInstance.visible = visible;

                    _broadcast(JSON.stringify({type: 'setVisible', args: {assetId, visible}}));
                  }
                } else if (method === 'setOpen') {
                  const {assetId, open} = args;
                  const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

                  if (assetInstance) {
                    assetInstance.open = open;

                    _broadcast(JSON.stringify({type: 'setOpen', args: {assetId, open}}));
                  }
                } else if (method === 'setPhysics') {
                  const {assetId, physics} = args;
                  const assetInstance = assetInstances.find(assetInstance => assetInstance.assetId === assetId);

                  if (assetInstance) {
                    assetInstance.physics = physics;

                    _broadcast(JSON.stringify({type: 'setPhysics', args: {assetId, physics}}));
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
