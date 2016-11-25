const idUtils = require('./lib/idUtils');

const FRAME_RATE = 60;
const TICK_TIME = 1000 / FRAME_RATE;
const DEBUG = true;

const engineKey = null;

class AnyikythClient {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/three',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {THREE, scene} = three;

        const debugMaterial = DEBUG ? new THREE.MeshBasicMaterial({
          color: 0xFF0000,
          wireframe: true,
        }) : null;

        const _makePlaneDebugMesh = (dimensions, position, rotation, scale) => {
          const geometry = new THREE.PlaneBufferGeometry(1024, 1024);
          geometry.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3().fromArray(dimensions)
          )));

          const mesh = new THREE.Mesh(geometry, debugMaterial);
          mesh.position.fromArray(position);
          mesh.quaternion.fromArray(rotation);
          mesh.scale.fromArray(scale);
          return mesh;
        };
        const _makeBoxDebugMesh = dimensions => {
          const geometry = new THREE.BoxBufferGeometry(dimensions[0], dimensions[1], dimensions[2]);
          const mesh = new THREE.Mesh(geometry, debugMaterial);
          return mesh;
        };
        const _makeSphereDebugMesh = size => {
          const geometry = new THREE.SphereBufferGeometry(size, 8, 8);
          const mesh = new THREE.Mesh(geometry, debugMaterial);
          return mesh;
        };
        const _makeBoundingBoxDebugMesh = points => {
          const bufferGeometry = new THREE.BufferGeometry();
          bufferGeometry.addAttribute('position', new THREE.BufferAttribute(Float32Array.from(points), 3));
          bufferGeometry.computeBoundingBox();
          const {boundingBox} = bufferGeometry;
          const w = boundingBox.max.x - boundingBox.min.x;
          const h = boundingBox.max.y - boundingBox.min.y;
          const d = boundingBox.max.z - boundingBox.min.z;
          const center = new THREE.Vector3(
            (boundingBox.min.x + boundingBox.max.x) / 2,
            (boundingBox.min.y + boundingBox.max.y) / 2,
            (boundingBox.min.z + boundingBox.max.z) / 2
          );

          const geometry = new THREE.BoxBufferGeometry(w, h, d);
          geometry.applyMatrix(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z));

          const mesh = new THREE.Mesh(geometry, debugMaterial);
          return mesh;
        };
        const _makeConvexHullDebugMesh = _makeBoundingBoxDebugMesh;
        const _makeTriangleMeshDebugMesh = (points, position, rotation, scale) => {
          const mesh = _makeBoundingBoxDebugMesh(points, position, rotation, scale);
          mesh.position.fromArray(position);
          mesh.quaternion.fromArray(rotation);
          mesh.scale.fromArray(scale);
          return mesh;
        };
        const _makeCompoundDebugMesh = children => {
          const mesh = new THREE.Object3D();

          for (let i = 0; i < children.length; i++) {
            const child = children[i];

            const childMesh = (() => {
              const {type, position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1]} = child;

              const result = (() => {
                switch (type) {
                  case 'plane': {
                    const {dimensions} = child;
                    return _makePlaneDebugMesh(dimensions);
                  }
                  case 'box': {
                    const {dimensions} = child;
                    return _makeBoxDebugMesh(dimensions);
                  }
                  case 'sphere': {
                    const {size} = child;
                    return _makeSphereDebugMesh(size);
                  }
                  case 'convexHull': {
                    const {points} = child;
                    return _makeConvexHullDebugMesh(points);
                  }
                  case 'triangleMesh': {
                    const {points} = child;
                    return _makeTriangleMeshDebugMesh(points);
                  }
                  default:
                    return null;
                }
              })();
              result.position.fromArray(position);
              result.quaternion.fromArray(rotation);
              result.scale.fromArray(scale);
              return result;
            })();
            mesh.add(childMesh);
          }

          return mesh;
        };

        class Entity {
          constructor(type, id = idUtils.makeId()) {
            this.type = type;
            this.id = id;

            this.debugMesh = null;
          }

          add(child) {
            const {id: parentId} = this;
            const {id: childId} = child;

            _request('add', [parentId, childId], _warnError);
          }

          remove(child) {
            const {id: parentId} = this;
            const {id: childId} = child;

            _request('remove', [parentId, childId], _warnError);
          }

          addDebug() {
            if (DEBUG) {
              if (this.makeDebugMesh) {
                const debugMesh = this.makeDebugMesh();
                scene.add(debugMesh);
                this.debugMesh = debugMesh;
              }
            }
          }

          removeDebug() {
            if (DEBUG) {
              if (this.makeDebugMesh) {
                const debugMesh = this.makeDebugMesh();
                scene.remove(debugMesh);
                this.debugMesh = null;
              }
            }
          }
        }

        class Engine extends Entity {
          constructor(opts = {}) {
            super('engine', opts.id);

            this.worlds = new Map();
          }

          add(world) {
            Entity.prototype.add.call(this, world);

            const {id: worldId} = world;
            this.worlds.set(worldId, world);
          }

          remove(world) {
            Entity.prototype.remove.call(this, world);

            const {id: worldId} = world;
            this.worlds.delete(worldId);
          }

          destroy() {
            this.worlds.forEach(world => {
              world.destroy();
            });
          }
        }

        class World extends Entity {
          constructor(opts = {}) {
            super('world', opts.id);

            const {type, id} = this;

            this.bodies = new Map();
            this.running = false;
            this.timeout = null;

            _request('create', [type, id, _except(opts, ['id'])], _warnError);

            engine.add(this);
          }

          add(object) {
            Entity.prototype.add.call(this, object);

            const {id: objectId} = object;
            this.bodies.set(objectId, object);

            object.addDebug();

            if (!this.running) {
              this.start();
            }
          }

          remove(object) {
            Entity.prototype.remove.call(this, object);

            const {id: objectId} = object;
            this.bodies.delete(objectId);

            object.removeDebug();

            if (this.bodies.size === 0) {
              this.stop();
            }
          }

          start() {
            let lastUpdateTime = null;
            const _recurse = () => {
              const timeUntilNextUpdate = (() => {
                if (lastUpdateTime === null) {
                  return 0;
                } else {
                  const now = Date.now();
                  const timeSinceLastUpdate = now - lastUpdateTime;
                  return Math.max(TICK_TIME - timeSinceLastUpdate, 0);
                }
              })();

              const _requestUpdate = () => {
                _request('requestUpdate', [this.id], (err, updates) => {
                  if (!err) {
                    for (let i = 0; i < updates.length; i++) {
                      const update = updates[i];
                      const {id} = update;

                      const body = this.bodies.get(id);
                      if (body) {
                        const {position, rotation, linearVelocity, angularVelocity} = update;
                        body.update({position, rotation, linearVelocity, angularVelocity});
                      } else {
                        console.warn('invalid body update:', JSON.stringify(id));
                      }
                    }
                  } else {
                    console.warn(err);
                  }

                  lastUpdateTime = Date.now();

                  _recurse();
                });
              };

              if (timeUntilNextUpdate === 0) {
                _requestUpdate();
              } else {
                this.timeout = setTimeout(() => {
                  _requestUpdate();

                  this.timeout = null;
                }, timeUntilNextUpdate);
              }
            };
            _recurse();

            this.running = true;
          }

          stop() {
            if (this.timeout) {
              clearTimeout(this.timeout);
              this.timeout = null;
            }

            this.running = false;
          }

          destroy() {
            if (this.running) {
              this.stop();
            }
          }
        }

        class Body extends Entity {
          constructor(type, opts = {}) {
            super(type, opts.id);

            const {id} = this;

            const linearVelocity = new THREE.Vector3();
            if (opts.linearVelocity) {
              linearVelocity.fromArray(opts.linearVelocity);
            }
            this.linearVelocity = linearVelocity;

            const angularVelocity = new THREE.Vector3();
            if (opts.angularVelocity) {
              angularVelocity.fromArray(opts.angularVelocity);
            }
            this.angularVelocity = angularVelocity;

            this.object = null;

            _request('create', [type, id, _except(opts, ['id'])], _warnError);
          }

          update({position, rotation, linearVelocity, angularVelocity}) {
            const {object} = this;
            if (object) {
              object.position.fromArray(position);
              object.quaternion.fromArray(rotation);
            }

            this.linearVelocity.fromArray(linearVelocity);
            this.angularVelocity.fromArray(angularVelocity);

            if (DEBUG) {
              const {debugMesh} = this;
              if (debugMesh) {
                debugMesh.position.fromArray(position);
                debugMesh.quaternion.fromArray(rotation);
              }
            }
          }

          setObject(object) {
            this.object = object;

            // this.sync();
          }

          unsetObject() {
            this.object = null;
          }

          setPosition(position) {
            const {id} = this;

            _request('setPosition', [id, position], _warnError);
          }

          setRotation(rotation) {
            const {id} = this;

            _request('setRotation', [id, rotation], _warnError);
          }

          setLinearVelocity(linearVelocity) {
            const {id} = this;

            _request('setLinearVelocity', [id, linearVelocity], _warnError);
          }

          setAngularVelocity(angularVelocity) {
            const {id} = this;

            _request('setAngularVelocity', [id, angularVelocity], _warnError);
          }

          setLinearFactor(linearFactor) {
            const {id} = this;

            _request('setLinearFactor', [id, linearFactor], _warnError);
          }

          setAngularFactor(angularFactor) {
            const {id} = this;

            _request('setAngularFactor', [id, angularFactor], _warnError);
          }

          activate() {
            _request('activate', [this.id], _warnError);
          }

          deactivate() {
            _request('deactivate', [this.id], _warnError);
          }

          setIgnoreCollisionCheck(targetBody, ignore) {
            _request('setIgnoreCollisionCheck', [this.id, targetBody.id, ignore], _warnError);
          }

          sync() {
            const {object} = this;

            this.setPosition(object.position.toArray());
            this.setRotation(object.quaternion.toArray());
            // this.setLinearVelocity([0, 0, 0]);
            // this.setAngularVelocity([0, 0, 0]);
            this.activate();
          }
        }

        class Plane extends Body {
          constructor(opts = {}) {
            super('plane', opts);

            const {position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1], dimensions} = opts;
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.dimensions = dimensions;
          }

          makeDebugMesh() {
            const {position, rotation, scale, dimensions} = this;
            return _makePlaneDebugMesh(dimensions, position, rotation, scale);
          }
        }

        class Box extends Body {
          constructor(opts = {}) {
            super('box', opts);

            const {dimensions} = opts;
            this.dimensions = dimensions;
          }

          makeDebugMesh() {
            return _makeBoxDebugMesh(this.dimensions);
          }
        }

        class Sphere extends Body {
          constructor(opts = {}) {
            super('sphere', opts);

            const {size} = opts;
            this.size = size;
          }

          makeDebugMesh() {
            return _makeSphereDebugMesh(this.size);
          }
        }

        class ConvexHull extends Body {
          constructor(opts = {}) {
            super('convexHull', opts);

            const {points} = opts;
            this.points = points;
          }

          makeDebugMesh() {
            return _makeConvexHullDebugMesh(this.points);
          }
        }

        class TriangleMesh extends Body {
          constructor(opts = {}) {
            super('triangleMesh', opts);

            const {position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1], points} = opts;
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.points = points;
          }

          makeDebugMesh() {
            const {position, rotation, scale, points} = this;
            return _makeTriangleMeshDebugMesh(points, position, rotation, scale);
          }
        }

        class Compound extends Body {
          constructor(opts = {}) {
            super('compound', opts);

            const {position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1], children} = opts;
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.children = children;
          }

          makeDebugMesh() {
            const {position, rotation, scale, children} = this;

            const mesh = _makeCompoundDebugMesh(children);
            mesh.position.fromArray(position);
            mesh.quaternion.fromArray(rotation);
            mesh.scale.fromArray(scale);
            return mesh;
          }
        }

        class Constraint extends Entity {
          constructor(opts = {}) {
            super('constraint', opts.id);

            const {type, id} = this;
            const {bodyA: {id: bodyAId}, bodyB: {id: bodyBId}, pivotA = [0, 0, 0], pivotB = [0, 0, 0]} = opts;

            _request('create', [type, id, {bodyAId, bodyBId, pivotA, pivotB}], _warnError);
          }
        }

        const engine = new Engine({
          id: null,
        });

        const _makeBody = mesh => {
          const {geometry} = mesh;
          const {type} = geometry;

          switch (type) {
            case 'Plane':
            case 'PlaneBufferGeometry': {
              const position = mesh.position.toArray();
              const rotation = mesh.quaternion.toArray();

              return new Plane({
                position,
                rotation,
                dimensions: [0, 0, 1],
                mass: 1,
              });
            }
            case 'BoxGeometry':
            case 'BoxBufferGeometry': {
              const position = mesh.position.toArray();
              const rotation = mesh.quaternion.toArray();
              const {parameters: {width, height, depth}} = geometry;

              return new Box({
                position,
                rotation,
                dimensions: [width, height, depth],
                mass: 1,
              });
            }
            case 'SphereGeometry':
            case 'Sphere': {
              const position = mesh.position.toArray();
              const rotation = mesh.quaternion.toArray();
              const {parameters: {radius}} = geometry;

              return new Sphere({
                position,
                rotation,
                size: radius,
                mass: 1,
              });
            }
            default: throw new Error('unsupported mesh type: ' + JSON.stringify(type));
          }
        };
        const _makeConvexHullBody = mesh => {
          const position = mesh.position.toArray();
          const rotation = mesh.quaternion.toArray();
          const points = _getGeometryPoints(mesh.geometry);

          return new ConvexHull({
            position,
            rotation,
            points,
            mass: 1,
          });
        };
        const _makeTriangleMeshBody = mesh => {
          const position = mesh.position.toArray();
          const rotation = mesh.quaternion.toArray();
          const points = _getGeometryPoints(mesh.geometry);

          return new TriangleMesh({
            position,
            rotation,
            points,
            mass: 1,
          });
        };

        const _requestWorld = worldId => new Promise((accept, reject) => {
          const world = new World({
            id: worldId,
          });
          world.Plane = Plane;
          world.Box = Box;
          world.Sphere = Sphere;
          world.ConvexHull = ConvexHull;
          world.TriangleMesh = TriangleMesh;
          world.Compound = Compound;
          world.Constraint = Constraint;
          world.makeBody = _makeBody;
          world.makeConvexHullBody = _makeConvexHullBody;
          world.makeTriangleMeshBody = _makeTriangleMeshBody;

          accept(world);
        });
        const _releaseWorld = worldId => new Promise((accept, reject) => {
          _request('remove', [null, worldId], err => {
            if (!err) {
              _request('destroy', [worldId], err => {
                if (!err) {
                  accept();
                } else {
                  reject(err);
                }
              });
            } else {
              reject(err);
            }
          });
        });

        let connection = null;
        let queue = [];
        const _ensureConnection = () => {
          if (!connection) {
            connection = new WebSocket('ws://' + location.host + '/archae/antikythWs');
            connection.onopen = () => {
              if (queue.length > 0) {
                for (let i = 0; i < queue.length; i++) {
                  const e = queue[i];
                  const es = JSON.stringify(e);
                  connection.send(es);
                }

                queue = [];
              }
            };
            connection.onerror = err => {
              connection = null;

              console.warn(err);
            };
            connection.onmessage = msg => {
              const m = JSON.parse(msg.data);
              const {id} = m;

              const requestHandler = requestHandlers.get(id);
              if (requestHandler) {
                const {error, result} = m;
                requestHandler(error, result);
              } else {
                console.warn('unregistered handler:', JSON.stringify(id));
              }
            };
          }
        };

        const requestHandlers = new Map();
        const _request = (method, args, cb) => {
          _ensureConnection();

          const id = idUtils.makeId();

          const e = {
            method,
            id,
            args,
          };
          if (connection.readyState === WebSocket.OPEN) {
            const es = JSON.stringify(e);
            connection.send(es);
          } else {
            queue.push(e);
          }

          const requestHandler = (err, result) => {
            if (!err) {
              cb(null, result);
            } else {
              cb(err);
            }

            requestHandlers.delete(id);
          };
          requestHandlers.set(id, requestHandler);
        };

        this._cleanup = () => {
          connection.close();

          engine.destroy();
        };

        return {
          requestWorld: _requestWorld,
          releaseWorld: _releaseWorld,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _except = (o, excepts) => {
  const result = {};

  for (const k in o) {
    if (!excepts.includes(k)) {
      result[k] = o[k];
    }
  }

  return result;
};

const _getGeometryPoints = geometry => {
  if (!(geometry instanceof BufferGeometry)) {
    geometry = new THREE.BufferGeometry().fromGeometry(geometry);
  }
  return Array.from(geometry.getAttribute('position').array);
};

const _warnError = err => {
  if (err) {
    console.warn(err);
  }
};

module.exports = AnyikythClient;
