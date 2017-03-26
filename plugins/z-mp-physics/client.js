const idUtils = require('./lib/idUtils');

const FRAME_RATE = 60;
const TICK_TIME = 1000 / FRAME_RATE;

const DISABLE_DEACTIVATION = 4;
const SIDES = ['left', 'right'];

class ZMpPhysics {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {server: {url: serverUrl}}} = archae;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    const {three: {THREE, scene}, render, player, elements, utils: {js: {events: {EventEmitter}}}} = zeo;

    const _decomposeObjectMatrixWorld = object => {
      const {matrixWorld} = object;
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrixWorld.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const zeroVector = new THREE.Vector3();
    const oneVector = new THREE.Vector3(1, 1, 1);

    const debugMaterial = new THREE.MeshBasicMaterial({
      color: 0xFF0000,
      wireframe: true,
    });

    const _requestConnection = () => new Promise((accept, reject) => {
      const connection = new WebSocket('wss://' + serverUrl + '/archae/bulletWs');
      connection.onopen = () => {
        accept(connection);
      };
      connection.onerror = err => {
        reject(err);
      };
    });

    _requestConnection()
      .then(connection => {
        if (live) {
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

          class Entity extends EventEmitter {
            constructor(type, id = idUtils.makeId()) {
              super();

              this.type = type;
              this.id = id;

              // this.debugMesh = null;
            }

            add(child) {
              const {id: parentId} = this;
              const {id: childId} = child;

              _request('add', [parentId, childId], _warnError);
            }

            addConnectionBound(child) {
              const {id: parentId} = this;
              const {id: childId} = child;

              _request('addConnectionBound', [parentId, childId], _warnError);
            }

            remove(child) {
              const {id: parentId} = this;
              const {id: childId} = child;

              _request('remove', [parentId, childId], _warnError);
            }

            removeConnectionBound() {
              // nothing
            }
          }

          /* class Engine extends Entity {
            constructor(opts = {}) {
              super('engine', opts.id);
            }
          } */

          class World extends Entity {
            constructor(opts = {}) {
              super('world', opts.id);

              const {type, id} = this;

              this.bodies = new Map();
              this.timeout = null;

              this.start();
            }

            requestInit() {
              return new Promise((accept, reject) => {
                _request('requestInit', [this.id], (err, objects) => {
                  if (!err) {
                    accept(objects);
                  } else {
                    reject(err);
                  }
                });
              });
            }

            add(object) {
              Entity.prototype.add.call(this, object);

              this.addBase(object);
            }

            addConnectionBound(object) {
              Entity.prototype.addConnectionBound.call(this, object);

              this.addBase(object);
            }

            addBase(object) {
              const {bodies} = this;
              const {id: objectId} = object;

              if (!bodies.has(objectId)) {
                bodies.set(objectId, object);
              }
            }

            remove(object) {
              Entity.prototype.remove.call(this, object);

              this.removeBase(object);
            }

            removeConnectionBound(object) {
              Entity.prototype.removeConnectionBound.call(this, object);

              this.removeBase(object);
            }

            removeBase(object) {
              const {bodies} = this;
              const {id: objectId} = object;

              if (bodies.has(objectId)) {
                bodies.delete(objectId);
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
                          console.warn('invalid body update:', id);
                        }
                      }
                    } else {
                      console.warn(err);
                    }

                    _next();
                  });
                };
                const _next = () => {
                  lastUpdateTime = Date.now();

                  _recurse();
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
            }

            stop() {
              if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
              }
            }

            destroy() {
              this.stop();
            }
          }

          class Body extends Entity {
            constructor(type, opts = {}) {
              const {id: optsId} = opts;
              super(type, optsId);

              const {id} = this; // the constructor might have generated it

              const {position = [0, 0, 0], rotation = [0, 0, 0, 1], linearVelocity = [0, 0, 0], angularVelocity = [0, 0, 0]} = opts;
              this.position = new THREE.Vector3().fromArray(position);
              this.rotation = new THREE.Quaternion().fromArray(rotation);
              this.linearVelocity = new THREE.Vector3().fromArray(linearVelocity);
              this.angularVelocity = new THREE.Vector3().fromArray(angularVelocity);

              if (opts.init !== false) {
                _request('create', [type, id, _except(opts, ['id'])], _warnError);
              }

              bodies.set(id, this);
            }

            update({position, rotation, linearVelocity, angularVelocity}) {
              this.position.fromArray(position);
              this.rotation.fromArray(rotation);
              this.linearVelocity.fromArray(linearVelocity);
              this.angularVelocity.fromArray(angularVelocity);

              this.emit('update', {
                position: this.position,
                rotation: this.rotation,
                scale: oneVector,
              });
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

            setActivationState(activationState) {
              _request('setActivationState', [this.id, activationState], _warnError);
            }

            setIgnoreCollisionCheck(targetBody, ignore) {
              _request('setIgnoreCollisionCheck', [this.id, targetBody.id, ignore], _warnError);
            }

            destroy() { // XXX should perform a backend remove here
              const {id} = this;
              bodies.delete(id);
            }
          }

          class Plane extends Body {
            constructor(opts = {}) {
              const body = opts.id ? bodies.get(opts.id) : null;

              if (body) {
                return body;
              } else {
                super('plane', opts);

                const {scale = [1, 1, 1], dimensions} = opts;
                this.scale = scale;
                this.dimensions = dimensions;
              }
            }

            /* makeDebugMesh() {
              const {position, rotation, scale, dimensions} = this;
              return _makePlaneDebugMesh(dimensions, position, rotation, scale);
            } */
          }

          class Box extends Body {
            constructor(opts = {}) {
              const body = opts.id ? bodies.get(opts.id) : null;

              if (body) {
                return body;
              } else {
                super('box', opts);

                const {dimensions} = opts;
                this.dimensions = dimensions;
              }
            }

            /* makeDebugMesh() {
              return _makeBoxDebugMesh(this.dimensions);
            } */
          }

          class Sphere extends Body {
            constructor(opts = {}) {
              const body = opts.id ? bodies.get(opts.id) : null;

              if (body) {
                return body;
              } else {
                super('sphere', opts);

                const {size} = opts;
                this.size = size;
              }
            }

            /* makeDebugMesh() {
              return _makeSphereDebugMesh(this.size);
            } */
          }

          class ConvexHull extends Body {
            constructor(opts = {}) {
              const body = opts.id ? bodies.get(opts.id) : null;

              if (body) {
                return body;
              } else {
                super('convexHull', opts);

                const {points} = opts;
                this.points = points;
              }
            }

            /* makeDebugMesh() {
              return _makeConvexHullDebugMesh(this.points);
            } */
          }

          class TriangleMesh extends Body {
            constructor(opts = {}) {
              const body = opts.id ? bodies.get(opts.id) : null;

              if (body) {
                return body;
              } else {
                super('triangleMesh', opts);

                const {scale = [1, 1, 1], points} = opts;
                this.scale = scale;
                this.points = points
              };
            }

            /* makeDebugMesh() {
              const {position, rotation, scale, points} = this;
              return _makeTriangleMeshDebugMesh(points, position, rotation, scale);
            } */
          }

          class Compound extends Body {
            constructor(opts = {}) {
              const body = opts.id ? bodies.get(opts.id) : null;

              if (body) {
                return body;
              } else {
                super('compound', opts);

                const {scale = [1, 1, 1], children} = opts;
                this.scale = scale;
                this.children = children
              };
            }

            /* makeDebugMesh() {
              const {position, rotation, scale, children} = this;

              const mesh = _makeCompoundDebugMesh(children);
              mesh.position.copy(position);
              mesh.quaternion.copy(rotation);
              mesh.scale.fromArray(scale);
              return mesh;
            } */
          }

          class Constraint extends Entity {
            constructor(opts = {}) {
              const body = opts.id ? bodies.get(opts.id) : null;

              if (body) {
                return body;
              } else {
                super('constraint', opts.id);

                const {type, id} = this;
                const {bodyA: {id: bodyAId}, bodyB: {id: bodyBId}, pivotA = [0, 0, 0], pivotB = [0, 0, 0]} = opts;

                _request('create', [type, id, {bodyAId, bodyBId, pivotA, pivotB}], _warnError);
              }
            }
          }

          const _makeBodyFromMesh = (mesh, {id = idUtils.makeId()} = {}) => {
            const {geometry} = mesh;
            const {type} = geometry;

            switch (type) {
              case 'Plane':
              case 'PlaneBufferGeometry': {
                const position = mesh.position.toArray();
                const rotation = mesh.quaternion.toArray();

                return new Plane({
                  id,
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
                  id,
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
                  id,
                  position,
                  rotation,
                  size: radius,
                  mass: 1,
                });
              }
              default: throw new Error('unsupported mesh type: ' + JSON.stringify(type));
            }
          };
          const _makeBodyFromSpec = spec => {
            const {type} = spec;

            switch (type) {
              case 'plane': {
                const {id, position, rotation, dimensions, mass} = spec;

                return new Plane({
                  id,
                  position,
                  rotation,
                  dimensions,
                  mass,
                  init: false,
                });
              }
              case 'box': {
                const {id, position, rotation, dimensions, mass} = spec;

                return new Box({
                  id,
                  position,
                  rotation,
                  dimensions,
                  mass,
                  init: false,
                });
              }
              case 'sphere': {
                const {id, position, rotation, size, mass} = spec;

                return new Sphere({
                  id,
                  position,
                  rotation,
                  size,
                  mass,
                  init: false,
                });
              }
              case 'convexHull': {
                const {id, position, rotation, points, mass} = spec;

                return new ConvexHull({
                  id,
                  position,
                  rotation,
                  points,
                  mass,
                  init: false,
                });
              }
              case 'triangleMesh': {
                const {id, position, rotation, points, mass} = spec;

                return new TriangleMesh({
                  id,
                  position,
                  rotation,
                  points,
                  mass,
                  init: false,
                });
              }
              case 'compound': {
                const {id, position, rotation, children, mass} = spec;

                return new Compound({
                  id,
                  position,
                  rotation,
                  children,
                  mass,
                  init: false,
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

          const _makeWorld = () => {
            const world = new World({
              id: 'world',
            });
            /* world.Plane = Plane;
            world.Box = Box;
            world.Sphere = Sphere;
            world.ConvexHull = ConvexHull;
            world.TriangleMesh = TriangleMesh;
            world.Compound = Compound;
            world.Constraint = Constraint;
            world.makeBodyFromMesh = _makeBodyFromMesh;
            world.makeBodyFromSpec = _makeBodyFromSpec;
            world.makeConvexHullBody = _makeConvexHullBody;
            world.makeTriangleMeshBody = _makeTriangleMeshBody; */
            return world;
          };

          const activePhysicsEntities = [];

          class BoxEntity extends EventEmitter {
            constructor({position, rotation, mass}) {
              super();

              this.position = position;
              this.rotation = rotation;
              this.mass = mass;

              this.mpPhysics = false;
              this.spPhysics = false;
              this.id = null;
              this.size = null;
              this.debug = false;

              this.body = null;
              this.debugMesh = null;

              activePhysicsEntities.push(this);
            }

            setMpPhysics(newValue) {
              this.mpPhysics = newValue;

              this.render();
              this.renderDebug();
            }

            setSpPhysics(newValue) {
              this.spPhysics = newValue;

              this.render();
              this.renderDebug();
            }

            setId(newValue) { // XXX handle the case where this changes at runtime
              this.id = newValue;

              this.render();
              this.renderDebug();
            }

            setSize(newValue) {
              this.size = newValue;

              this.render();
              this.renderDebug();
            }

            setDebug(newValue) {
              this.debug = newValue;

              this.renderDebug();
            }

            setPosition(position) {
              this.position = position;

              const {body} = this;
              if (body) {
                body.setPosition(position.toArray());
              }
              const {debugMesh} = this; // XXX no need to set the debug mesh position here
              if (debugMesh) {
                debugMesh.position.copy(position);
              }
            }

            setRotation(rotation) {
              this.rotation = rotation;

              const {body} = this;
              if (body) {
                body.setRotation(rotation.toArray());
              }
              const {debugMesh} = this;
              if (debugMesh) {
                debugMesh.quaternion.copy(rotation);
              }
            }

            setLinearVelocity(linearVelocity) {
              this.linearVelocity = linearVelocity;

              const {body} = this;
              if (body) {
                body.setLinearVelocity(linearVelocity.toArray());
              }
            }

            setAngularVelocity(angularVelocity) {
              this.angularVelocity = angularVelocity;

              const {body} = this;
              if (body) {
                body.setAngularVelocity(angularVelocity.toArray());
              }
            }

            setLinearFactor(linearFactor) {
              this.linearFactor = linearFactor;

              const {body} = this;
              if (body) {
                body.setLinearFactor(linearFactor.toArray());
              }
            }

            setAngularFactor(angularFactor) {
              this.angularFactor = angularFactor;

              const {body} = this;
              if (body) {
                body.setAngularFactor(angularFactor.toArray());
              }
            }

            setActivationState(activationState) {
              this.activationState = activationState;

              const {body} = this;
              if (body) {
                body.setActivationState(activationState);
              }
            }

            render() {
              const {body} = this;
              if (body) {
                world.remove(body);
                this.body = null;
              }

              const {mpPhysics, spPhysics, id, size} = this;
              if (mpPhysics && !spPhysics && id && size) {
                const body = (() => {
                  const {position, rotation} = this;

                  return new Box({
                    id,
                    position: position.toArray(),
                    rotation: rotation.toArray(),
                    dimensions: size,
                    mass: 1,
                  });
                })();
                body.on('update', ({position, rotation, scale}) => {
                  this.emit('update', {position, rotation, scale});

                  const {debugMesh} = this;
                  if (debugMesh) {
                    debugMesh.position.copy(position);
                    debugMesh.quaternion.copy(rotation);
                    debugMesh.scale.copy(scale);
                  }
                });
                world.add(body);
                this.body = body;
              }
            }

            renderDebug() {
              const {debugMesh: oldDebugMesh} = this;
              if (oldDebugMesh) {
                scene.remove(oldDebugMesh);
                this.debugMesh = null;
              }

              const {mpPhysics, spPhysics, debug, size} = this;
              if (mpPhysics && !spPhysics && debug && size) {
                const newDebugMesh = _makeBoxDebugMesh(size);
                const {position, rotation} = this;
                newDebugMesh.position.copy(position);
                newDebugMesh.quaternion.copy(rotation);

                scene.add(newDebugMesh);
                this.debugMesh = newDebugMesh;
              }
            }

            destroy() {
              activePhysicsEntities.splice(activePhysicsEntities.indexOf(this), 1);

              const {body} = this;
              if (body) {
                world.remove(body);

                body.destroy();
              }
            }
          }
          class CompoundEntity extends EventEmitter {
            constructor({position, rotation, children, mass}) {
              super();

              this.position = position;
              this.rotation = rotation;
              this.children = children;
              this.mass = mass;

              this.mpPhysics = false;
              this.spPhysics = false;
              this.id = false;
              this.debug = false;

              this.linearVelocity = null;
              this.angularVelocity = null;
              this.linearFactor = null;
              this.angularFactor = null;
              this.activationState = null;

              this.body = null;
              this.debugMesh = null;
            }          

            setMpPhysics(newValue) {
              this.mpPhysics = newValue;

              this.render();
              this.renderDebug();
            }

            setSpPhysics(newValue) {
              this.spPhysics = newValue;

              this.render();
              this.renderDebug();
            }

            setId(newValue) {
              this.id = newValue;

              this.render();
              this.renderDebug();
            }

            setDebug(newValue) {
              this.debug = newValue;

              this.renderDebug();
            }

            setPosition(position) {
              this.position = position;

              const {body} = this;
              if (body) {
                body.setPosition(position.toArray());
              }
              const {debugMesh} = this;
              if (debugMesh) {
                debugMesh.position.copy(position);
              }
            }

            setRotation(rotation) {
              this.rotation = rotation;

              const {body} = this;
              if (body) {
                body.setRotation(rotation.toArray());
              }
              const {debugMesh} = this;
              if (debugMesh) {
                debugMesh.quaternion.copy(rotation);
              }
            }

            setLinearVelocity(linearVelocity) {
              this.linearVelocity = linearVelocity;

              const {body} = this;
              if (body) {
                body.setLinearVelocity(linearVelocity.toArray());
              }
            }

            setAngularVelocity(angularVelocity) {
              this.angularVelocity = angularVelocity;

              const {body} = this;
              if (body) {
                body.setAngularVelocity(angularVelocity.toArray());
              }
            }

            setLinearFactor(linearFactor) {
              this.linearFactor = linearFactor;

              const {body} = this;
              if (body) {
                body.setLinearFactor(linearFactor.toArray());
              }
            }

            setAngularFactor(angularFactor) {
              this.angularFactor = angularFactor;

              const {body} = this;
              if (body) {
                body.setAngularFactor(angularFactor.toArray());
              }
            }

            setActivationState(activationState) {
              this.activationState = activationState;

              const {body} = this;
              if (body) {
                body.setActivationState(activationState);
              }
            }

            render() {
              const {body} = this;
              if (body) {
                world.remove(body);
                this.body = null;
              }

              const {mpPhysics, spPhysics, id, children} = this;
              if (mpPhysics && !spPhysics && id && children) {
                const body = (() => {
                  const {id, position, rotation, mass} = this;

                  return new Compound({
                    id,
                    position,
                    rotation,
                    children,
                    mass,
                  });
                })();
                body.on('update', ({position, rotation, scale}) => {
                  this.emit('update', {position, rotation, scale});

                  const {debugMesh} = this;
                  if (debugMesh) {
                    debugMesh.position.copy(position);
                    debugMesh.quaternion.copy(rotation);
                    debugMesh.scale.copy(scale);
                  }
                });
                world.add(body);
                this.body = body;
              }
            }

            renderDebug() {
              const {debugMesh: oldDebugMesh} = this;
              if (oldDebugMesh) {
                scene.remove(oldDebugMesh);
                this.debugMesh = null;
              }

              const {mpPhysics, spPhysics, debug, id, children} = this;
              if (mpPhysics && !spPhysics && debug && id && children) {
                const newDebugMesh = _makeCompoundDebugMesh(children);
                const {position, rotation} = this;
                newDebugMesh.position.copy(position);
                newDebugMesh.quaternion.copy(rotation);

                scene.add(newDebugMesh);
                this.debugMesh = newDebugMesh;
              }
            }

            destroy() {
              activePhysicsEntities.splice(activePhysicsEntities.indexOf(this), 1);

              const {body} = this;
              if (body) {
                world.remove(body);

                body.destroy();
              }
            }
          }

          const requestHandlers = new Map();
          const _request = (method, args, cb) => {
            const id = idUtils.makeId();

            const e = {
              method,
              args,
              id,
            };
            const es = JSON.stringify(e);
            connection.send(es);

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

          connection.onclose = () => {
            console.warn('mp physics connection closed');
          };
          connection.onmessage = msg => {
            const m = JSON.parse(msg.data);
            const {type} = m;

            if (type === 'response') {
              const {id} = m;

              const requestHandler = requestHandlers.get(id);
              if (requestHandler) {
                const {error, result} = m;
                requestHandler(error, result);
              } else {
                console.warn('unregistered response handler:', id);
              }
            } else if (type === 'create') {
              const {args} = m;
              const [type, id, opts] = args;

              opts.type = type;
              opts.id = id;

              world.makeBodyFromSpec(opts);
            } else if (type === 'destroy') {
              const {args} = m;
              const [id] = args;

              const physicsBody = bodies.get(id);
              physicsBody.destroy();
            } else if (type === 'add') {
              const {args} = m;
              const [parentId, childId] = args;

              if (parentId === world.id) {
                const physicsBody = bodies.get(childId);
                world.addBase(physicsBody);
              } else {
                console.warn('adding to non-world:', id);
              }
            } else if (type === 'remove') {
              const {args} = m;
              const [parentId, childId] = args;

              if (parentId === world.id) {
                const physicsBody = bodies.get(childId);
                world.removeBase(physicsBody);
              } else {
                console.warn('removing from non-world:', id);
              }
            } else {
              console.warn('invalid message type:', id);
            }
          };

          const world = _makeWorld();
          const bodies = new Map();
          world.requestInit()
            .then(objects => {
              for (let i = 0; i < objects.length; i++) {
                const object = objects[i];
                const {id} = object;
                const oldBody = world.bodies.get(id);

                if (oldBody) {
                  const {position, rotation, linearVelocity, angularVelocity} = object;
                  oldBody.update({position, rotation, linearVelocity, angularVelocity});
                } else {
                  const newBody = world.makeBodyFromSpec(object);
                  world.addBase(newBody);
                }
              }
            })
            .catch(err => {
              console.warn(err);
            });

          const floorBody = new Box({
            id: 'floor',
            position: [0, -1024 / 2, 0],
            dimensions: [1024, 1024, 1024],
            mass: 0,
          });
          world.add(floorBody);

          // controllers
          const controllerMeshes = player.getControllerMeshes();
          const controllerPhysicsEntities = SIDES.map(side => {
            const controllerMesh = controllerMeshes[side];
            const {position, quaternion: rotation} = controllerMesh;
            const controllerPhysicsEntity = new CompoundEntity({
              position,
              rotation,
              children: [
                {
                  type: 'box',
                  dimensions: [0.115, 0.075, 0.215],
                  position: [0, -(0.075 / 2), (0.215 / 2) - 0.045],
                },
              ],
              mass: 1,
            });
            controllerPhysicsEntity.setLinearFactor(zeroVector);
            controllerPhysicsEntity.setAngularFactor(zeroVector);
            controllerPhysicsEntity.setLinearVelocity(zeroVector);
            controllerPhysicsEntity.setAngularVelocity(zeroVector);
            controllerPhysicsEntity.setActivationState(DISABLE_DEACTIVATION);
            controllerPhysicsEntity.setMpPhysics(true);
            controllerPhysicsEntity.setId(player.getId() + '-controller-' + side);

            const _update = () => {
              controllerPhysicsEntity.setPosition(controllerMesh.position);
              controllerPhysicsEntity.setRotation(controllerMesh.quaternion);
            };
            render.on('update', _update)

            cleanups.push(() => {
              render.removeListener('update', _update)
            });

            return controllerPhysicsEntity;
          });

          const _updateControllersDebugMeshes = () => {
            const numPhysicsDebugs = (() => {
              let result = 0;

              for (let i = 0; i < activePhysicsEntities.length; i++) {
                const physicsBody = activePhysicsEntities[i];
                const {debug} = physicsBody;
                result += Number(debug);
              }

              return result;
            })();
            const controllerPhysicsDebug = numPhysicsDebugs > 0;
            for (let i = 0; i < controllerPhysicsEntities.length; i++) {
              const controllerPhysicEntity = controllerPhysicsEntities[i];
              controllerPhysicEntity.setDebug(controllerPhysicsDebug);
            }
          };

          const mpPhysicsComponent = {
            selector: '[mp-physics][mp-physics-id][size]',
            attributes: {
              'mp-physics': {
                type: 'checkbox',
                value: true,
              },
              'mp-physics-id': {
                type: 'text',
                value: _makeId,
              },
              'size': {
                type: 'vector',
                value: [1, 1, 1],
                min: 0.1,
                max: 1,
                step: 0.1,
              },
              'physics-debug': {
                type: 'checkbox',
                value: false,
              },
              'sp-physics': {
                type: 'checkbox',
                value: false,
              },
            },
            entityAddedCallback(entityElement) {
              const entityObject = entityElement.getObject();

              const {position, rotation} = _decomposeObjectMatrixWorld(entityObject);
              const physicsEntity = new BoxEntity({
                position,
                rotation,
                mass: 1,
              });
              entityElement.setComponentApi(physicsEntity);

              physicsEntity.on('update', ({position, rotation, scale}) => {
                entityElement.setState('position', position);
                entityElement.setState('rotation', rotation);
                entityElement.setState('scale', scale);
              });

              const _release = e => {
                const {detail: {linearVelocity, angularVelocity}} = e;

                physicsEntity.setLinearVelocity(linearVelocity);
                physicsEntity.setAngularVelocity(angularVelocity);
              };
              entityElement.addEventListener('release', _release);

              physicsEntity.destroy = (destroy => () => {
                destroy();

                entityElement.removeEventListener('release', _release);
              })(physicsEntity.destroy.bind(physicsEntity));
            },
            entityRemovedCallback(entityElement) {
              const physicsEntity = entityElement.getComponentApi();
              physicsEntity.destroy();

              _updateControllersDebugMeshes();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const physicsEntity = entityElement.getComponentApi();

              switch (name) {
                case 'mp-physics': {
                  physicsEntity.setMpPhysics(newValue);

                  break;
                }
                case 'mp-physics-id': {
                  physicsEntity.setId(newValue);

                  break;
                }
                case 'size': {
                  physicsEntity.setSize(newValue);

                  break;
                }
                case 'sp-physics': {
                  physicsEntity.setSpPhysics(newValue);

                  break;
                }
                case 'physics-debug': {
                  physicsEntity.setDebug(newValue);

                  _updateControllersDebugMeshes();

                  break;
                }
              }
            },
            entityStateChangedCallback(entityElement, key, oldValue, newValue) {
              const entityObject = entityElement.getObject();

              switch (key) {
                case 'position': {
                  entityObject.position.copy(newValue);

                  break;
                }
                case 'rotation': {
                  entityObject.quaternion.copy(newValue);

                  break;
                }
                case 'scale': {
                  entityObject.scale.copy(newValue);

                  break;
                }
              }
            },
          };
          elements.registerComponent(this, mpPhysicsComponent);

          cleanups.push(() => {
            if (connection.readyState === WebSocket.OPEN) {
              connection.close();
            }

            elements.unregisterComponent(this, mpPhysicsComponent);
          });
        } else {
          connection.close();
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);
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

module.exports = ZMpPhysics;
