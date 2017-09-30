const Zlib = require('./inflate.min.js');
const FBXLoader = require('./FBXLoader');

class Model {
  mount() {
    const {three: {THREE, scene}, input, elements, hands, utils: {network: networkUtils}} = zeo;
    const {AutoWs} = networkUtils;

    const THREEFBXLoader = FBXLoader({THREE, Zlib});
    const manager = new THREE.LoadingManager();
    const _loadModel = (value, position) => {
      const loader = new THREEFBXLoader(manager);
      loader.load('/archae/fs/hash/' + value, object => {
        const parent = new THREE.Object3D();
        parent.position.copy(position);
        parent.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 1, 0)
        );
        parent.add(object);
        parent.updateMatrixWorld();
        scene.add(parent);
      }, progress => {
        // console.log('progress', progress);
      }, err => {
        console.warn(err);
      });
    };

    const modelEntity = {
      attributes: {},
      entityAddedCallback(entityElement) {
        const _triggerdown = e => {
          const {side} = e;
          const grabbable = hands.getGrabbedGrabbable(side);

          if (grabbable && grabbable.type === 'file') {
            const {value, position} = grabbable;
            _loadModel(value, position.clone());
            connection.send(JSON.stringify({
              type: 'model',
              value,
              position: position.toArray(),
            }));
          }
        };
        input.on('triggerdown', _triggerdown);

        const connection = new AutoWs(_relativeWsUrl('archae/modelWs'));
        connection.on('message', msg => {
          const e = JSON.parse(msg.data);
          const {type} = e;

          if (type === 'model') {
            const {value, position} = e;
            _loadModel(value, new THREE.Vector3().fromArray(position));
          } else {
            console.warn('model plugin unknown model type', type);
          }
        });

        entityElement._cleanup = () => {
          input.removeListener('triggerdown', _triggerdown);

          connection.destroy();
        };
      },
      entityRemovedCallback(entityElement) {
        entityElement._cleanup();
      },
    }
    elements.registerEntity(this, modelEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, modelEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}
const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};

module.exports = Model;
