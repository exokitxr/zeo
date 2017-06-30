const murmur = require('murmurhash');

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
          constructor(id, n, object, bindObject) {
            super();

            this.id = id;
            this.n = n;
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

          setState(position, rotation, linearVelocity, angularVelocity, activate) {
            const {n} = this;

            const e = {
              method: 'setState',
              args: [n, position, rotation, linearVelocity, angularVelocity, activate],
            };
            const es = JSON.stringify(e);
            connection.send(es);
          }
        }

        const connection = new AutoWs(_relativeWsUrl('archae/physicsWs?id=' + localUserId));
        connection.on('message', connectionMessage => {
          const connectionMessageU32 = new Uint32Array(connectionMessage.data, 0, 1);
          const n = connectionMessageU32[0];
          const body = bodies[n];

          if (body) {
            const connectionMessageF64 = new Float64Array(connectionMessage.data, 1 * 8, 3 + 4);
            const position = [connectionMessageF64[0], connectionMessageF64[1], connectionMessageF64[2]];
            const rotation = [connectionMessageF64[3], connectionMessageF64[4], connectionMessageF64[5], connectionMessageF64[6]];
            body.update(position, rotation);
          }
        });

        this._cleanup = () => {
          connection.destroy();
        };

        const _makeBody = (object, id, {bindObject = true, bindConnection = true, mass = 1, position = null, rotation = null, linearFactor = [1, 1, 1], angularFactor = [1, 1, 1], disableDeactivation = false} = {}) => {
          const n = murmur(id);
          const oldBody = bodies[n];

          if (oldBody) {
            return oldBody;
          } else {
            const {constructor} = object;

            let result = null;
            const _getMatrix = () => {
              if (result === null) {
                result = _decomposeMatrix(object.matrix);
              }
              return result;
            };

            if (constructor === THREE.Mesh) {
              const body = new Body(id, n, object, bindObject);
              bodies[n] = body;

              const {geometry} = object;
              const {constructor} = geometry;

              if (constructor === THREE.BoxBufferGeometry) {
                const {parameters: {width, height, depth}} = geometry;
                if (position === null) {
                  position = _getMatrix().position.toArray();
                }
                if (rotation === null) {
                  rotation = _getMatrix().rotation.toArray();
                }
                const owner = bindConnection ? localUserId : null;
                const e = {
                  method: 'add',
                  args: [n, 'box', [width, height, depth], position, rotation, mass, linearFactor, angularFactor, disableDeactivation, owner],
                };
                const es = JSON.stringify(e);
                connection.send(es);

                return body;
              } else if (constructor === THREE.PlaneBufferGeometry) {
                const body = new Body(id, n, object, bindObject);
                bodies[n] = body;

                const geometryClone = geometryUtils.unindexBufferGeometry(geometry.clone());
                const positions = geometryClone.getAttribute('position').array;
                const normal = new THREE.Triangle(
                  new THREE.Vector3(positions[0], positions[1], positions[2]),
                  new THREE.Vector3(positions[3], positions[4], positions[5]),
                  new THREE.Vector3(positions[6], positions[7], positions[8]),
                ).normal();
                const constant = object.position.length();
                const owner = bindConnection ? localUserId : null;
                const e = {
                  method: 'add',
                  args: [n, 'plane', normal.toArray().concat([constant]), [0, 0, 0], [0, 0, 0, 1], mass, linearFactor, angularFactor, disableDeactivation, owner],
                };
                const es = JSON.stringify(e);
                connection.send(es);

                return body;
              } else if (constructor === THREE.BufferGeometry) {
                const body = new Body(id, n, object, bindObject);
                bodies[n] = body;

                if (position === null) {
                  position = _getMatrix().position.toArray();
                }
                if (rotation === null) {
                  rotation = _getMatrix().rotation.toArray();
                }
                const positions = geometry.getAttribute('position').array;
                const numPositions = positions.length / 3;
                const width = Math.sqrt(numPositions);
                const height = width;
                const yPositions = new Float32Array(numPositions);
                for (let i = 0; i < numPositions; i++) {
                  yPositions[i] = positions[(i * 3) + 1];
                }
                const yPositionsBase64 = _arrayToBase64(new Uint8Array(yPositions.buffer, yPositions.byteOffset, yPositions.length * 4));
                const owner = bindConnection ? localUserId : null;
                const e = {
                  method: 'add',
                  args: [n, 'heightfield', [width, height, yPositionsBase64], position, rotation, mass, linearFactor, angularFactor, disableDeactivation, owner],
                };
                const es = JSON.stringify(e);
                connection.send(es);

                return body;
              } else {
                console.warn('Invalid mesh type', constructor);

                return null;
              }
            } else if (constructor === THREE.Object3D) {
              const body = new Body(id, n, object, bindObject);
              bodies[n] = body;

              const {children} = object;

              const spec = [];
              for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const {geometry} = child;
                const {constructor} = geometry;

                if (constructor === THREE.BoxBufferGeometry) {
                  const {parameters: {width, height, depth}} = geometry;
                  const {position, rotation} = _decomposeMatrix(child.matrix);

                  spec.push(['box', [width, height, depth], position.toArray(), rotation.toArray()]);
                } else {
                  console.warn('Invalid compound child type', constructor);
                }
              }
              if (position === null) {
                position = _getMatrix().position.toArray();
              }
              if (rotation === null) {
                rotation = _getMatrix().rotation.toArray();
              }
              const owner = bindConnection ? localUserId : null;
              const e = {
                method: 'add',
                args: [n, 'compound', spec, position, rotation, mass, linearFactor, angularFactor, disableDeactivation, owner],
              };
              const es = JSON.stringify(e);
              connection.send(es);

              return body;
            } else {
              console.warn('Invalid object type', constructor);

              return null;
            }
          }
        };
        const _destroyBody = body => {
          const {n} = body;
          const e = {
            method: 'remove',
            args: [n],
          };
          const es = JSON.stringify(e);
          connection.send(es);

          delete bodies[n];
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
const _arrayToBase64 = array => {
  let binary = '';
  for (let i = 0; i < array.byteLength; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
};

module.exports = Physics;
