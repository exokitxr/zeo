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
      '/core/utils/geometry-utils',
      '/core/utils/network-utils',
    ]).then(([
      three,
      input,
      webvr,
      rend,
      multiplayer,
      jsUtils,
      geometryUtils,
      networkUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {AutoWs} = networkUtils;

        const localUserId = multiplayer.getId();

        /* const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld); */
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

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

          setState(position, rotation) {
            const {id} = this;

            const e = {
              method: 'setState',
              args: [id, position, rotation],
            };
            const es = JSON.stringify(e);
            connection.send(es);
          }
        }

        const connection = new AutoWs(_relativeWsUrl('archae/physicsWs?id=' + localUserId));
        connection.on('message', msg => {
          const m = JSON.parse(msg.data);
          const {id} = m;
          const body = bodies[id];

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

            if (constructor === THREE.BoxBufferGeometry) {
              const {parameters: {width, height, depth}} = geometry;
              const {position, rotation} = _decomposeMatrix(object.matrix);
              const e = {
                method: 'add',
                args: [id, 'box', [width, height, depth], position.toArray(), rotation.toArray(), mass],
              };
              const es = JSON.stringify(e);
              connection.send(es);

              const body = new Body(id, object, bindObject);
              bodies[id] = body;

              return body;
            } else if (constructor === THREE.PlaneBufferGeometry) {
              const geometryClone = geometryUtils.unindexBufferGeometry(geometry.clone());
              const positions = geometryClone.getAttribute('position').array;
              const normal = new THREE.Triangle(
                new THREE.Vector3(positions[0], positions[1], positions[2]),
                new THREE.Vector3(positions[3], positions[4], positions[5]),
                new THREE.Vector3(positions[6], positions[7], positions[8]),
              ).normal();
              const constant = object.position.length();
              const e = {
                method: 'add',
                args: [id, 'plane', normal.toArray().concat([constant]), [0, 0, 0], [0, 0, 0, 1], mass],
              };
              const es = JSON.stringify(e);
              connection.send(es);

              const body = new Body(id, object, bindObject);
              bodies[id] = body;

              return body;

              return body;
            } else {
              console.warn('Invalid mesh type', object);

              return null;
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

const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};

module.exports = Physics;
