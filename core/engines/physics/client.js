class Physics {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/rend',
      '/core/engines/multiplayer',
      '/core/utils/js-utils',
      '/core/utils/network-utils',
    ]).then(([
      three,
      input,
      webvr,
      rend,
      multiplayer,
      jsUtils,
      networkUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {AutoWs} = networkUtils;

        const localUserId = multiplayer.getId();

        /* const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        }; */

        const bodies = {};

        class Body extends EventEmitter {
          constructor(id, object, bindObject) {
            super();

            this.id = id;
            this.object = object;
            this.bindObject = bindObject;
          }

          update(position, rotation) {
            const {bindObject} = this;

            if (bindObject) {
              const {object} = this;

              object.position.fromArray(position);
              object.quaternion.fromArray(rotation);
              object.updateMatrixWorld();
            }

            const u = {
              position,
              rotation,
            };
            this.emit('update', u);
          }
        }

        const connection = new AutoWs(_relativeWsUrl('archae/physicsWs?id=' + localUserId));
        connection.on('message', msg => {
          const m = JSON.parse(msg.data);
          const {id} = m;
          const body = bodies[i];

          if (body) {
            const {position, rotation} = m;
            body.update(position, rotation);
          }
        });

        this._cleanup = () => {
          connection.destroy();
        };

        const _makeBody = (object, id, {bindObject = true, bindConnection = true, mass = 1} = {}) => {
          const oldBody = bodies[id];

          if (oldBody) {
            return oldBody;
          } else {
            const {geometry} = object;
            const {constructor} = geometry;

            if (constructor === THREE.BoxGeometry || constructor === THREE.BoxBufferGeometry) {
              const {parameters: {width, height, depth}} = geometry;
              const e = {
                method: 'add',
                args: [id, 'box', [width, height, depth], object.position.toArray, object.quaternion.toArray(), mass],
              };
              const es = JSON.stringify(e);
              connection.send(es);

              const body = new Body(id, object, bindObject);
              bodies[id] = body;
            } else {
              console.warn('Invalid mesh type', object);
            }
          }
        };
        const _destroyBody = body => {
          const {id} = body;
          const e = {
            method: 'remove',
            args: [id],
          };
          const es = JSON.stringify(e);
          connection.send(es);

          delete bodies[id];
        };

        return {
          makeBody: _makeBody,
          destroyBody: _destroyBody,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Physics;
