const Zlib = require('./inflate.min.js');
const FBXLoader = require('./FBXLoader');

class Model {
  mount() {
    const {three: {THREE, scene}, input, pose, elements, hands, notification, utils: {network: networkUtils}} = zeo;
    const {AutoWs} = networkUtils;

    const models = {};

    const _makeNotificationText = n => {
      let s = 'Downloading ' + (n * 100).toFixed(1) + '% [';
      let i;
      const roundN = Math.round(n * 20);
      for (i = 0; i < roundN; i++) {
        s += '|';
      }
      for (; i < 20; i++) {
        s += '.';
      }
      s += ']';
      return s;
    };

    const THREEFBXLoader = FBXLoader({THREE, Zlib});
    const manager = new THREE.LoadingManager();
    const _loadModel = (id, value, position) => {
      const note = notification.addNotification(_makeNotificationText(0));

      const loader = new THREEFBXLoader(manager);
      loader.load('/archae/fs/hash/' + value, object => {
        object.position.copy(position);
        object.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 1, 0)
        );
        object.updateMatrixWorld();
        object.boundingBox = new THREE.Box3().setFromObject(object);
        scene.add(object);
        models[id] = object;

        notification.removeNotification(note);
      }, e => {
        if (e.lengthComputable) {
          note.set(_makeNotificationText(e.loaded / e.total));
        } else {
          note.set(_makeNotificationText(0.5));
        }
      }, err => {
        console.warn(err);

        notification.removeNotification(note);
      });
    };
    const _removeModel = id => {
      const object = models[id];
      scene.remove(object);
      _dispose(object);
      models[id] = null;
    };
    const _dispose = o => {
      if (o.geometry) {
        o.geometry.dispose();
      }
      if (o.material) {
        o.material.dispose();
      }
      if (o.children) {
        for (let i = 0; i < o.children.length; i++) {
          _dispose(o.children[i]);
        }
      }
    };

    const modelEntity = {
      attributes: {},
      entityAddedCallback(entityElement) {
        const _triggerdown = e => {
          const {side} = e;
          const grabbable = hands.getGrabbedGrabbable(side);

          if (grabbable && grabbable.type === 'file') {
            const {value, position} = grabbable;
            const id = Math.random();
            _loadModel(id, value, position.clone());
            connection.send(JSON.stringify({
              type: 'add',
              id,
              value,
              position: position.toArray(),
            }));
          } else {
            const {gamepads} = pose.getStatus();
            const gamepad = gamepads[side];
            const {worldPosition: controllerPosition} = gamepad;
            for (const id in models) {
              const model = models[id];
              if (model && model.boundingBox.containsPoint(controllerPosition)) {
                _removeModel(id);
                connection.send(JSON.stringify({
                  type: 'remove',
                  id,
                }));
              }
            }
          }
        };
        input.on('triggerdown', _triggerdown);

        const connection = new AutoWs(_relativeWsUrl('archae/modelWs'));
        connection.on('message', msg => {
          const e = JSON.parse(msg.data);
          const {type} = e;

          if (type === 'add') {
            const {id, value, position} = e;
            _loadModel(id, value, new THREE.Vector3().fromArray(position));
          } else if (type === 'remove') {
            const {id} = e;
            _removeModel(id);
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
