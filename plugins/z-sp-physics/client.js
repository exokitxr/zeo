const FPS = 90;
const RESOLUTION = 4;
const STEP_SECONDS = 1 / FPS;
const STEP_MILLISECONDS = 1000 / FPS;

const DISABLE_DEACTIVATION = 4;

const SIDES = ['left', 'right'];

class ZSpPhysics {
  mount() {
    const {_archae: archae} = this;

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

    const _requestAmmo = () => new Promise((accept, reject) => {
      const script = document.createElement('script');
      script.src = '/archae/sp-physics/lib/ammo.js';
      script.onload = () => {
        document.body.removeChild(script);

        accept(window.Ammo);
      };
      script.onerror = err => {
        document.body.removeChild(script);

        reject(err);
      };
      document.body.appendChild(script);
    });

    return _requestAmmo()
      .then(Ammo => {
        if (live) {
          const {three: {THREE, camera, scene}, player, render, elements, utils: {js: {events: {EventEmitter}}}} = zeo;

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            // shading: THREE.FlatShading,
          });

          const zeroVector = new THREE.Vector3();
          const oneVector = new THREE.Vector3(1, 1, 1);
          const zeroQuaternion = new THREE.Quaternion();

          const _decomposeObjectMatrixWorld = object => {
            const {matrixWorld} = object;
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrixWorld.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          // world
          const collisionConfiguration  = new Ammo.btDefaultCollisionConfiguration();
          const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
          const overlappingPairCache = new Ammo.btDbvtBroadphase();
          const solver = new Ammo.btSequentialImpulseConstraintSolver();
          const dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
          dynamicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));

          // ground
          (() => {
            const groundShape = new Ammo.btBoxShape(new Ammo.btVector3(1024, 1024, 1024));
            const groundTransform = new Ammo.btTransform();
            groundTransform.setIdentity();
            groundTransform.setOrigin(new Ammo.btVector3(0, -1024, 0));

            const mass = 0;
            const isDynamic = (mass !== 0);
            const localInertia  = new Ammo.btVector3(0, 0, 0);

            if (isDynamic) {
              groundShape.calculateLocalInertia(mass, localInertia);
            }

            const myMotionState = new Ammo.btDefaultMotionState(groundTransform);
            const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, myMotionState, groundShape, localInertia);
            const body = new Ammo.btRigidBody(rbInfo);
            dynamicsWorld.addRigidBody(body);
          })();

          const activePhysicsBodies = [];

          let lastUpdateTime = Date.now();
          const trans = new Ammo.btTransform();
          const interval = setInterval(() => {
            const now = Date.now();
            const timeDiff = now - lastUpdateTime;
            dynamicsWorld.stepSimulation(timeDiff, RESOLUTION, STEP_SECONDS / RESOLUTION);

            for (let i = 0; i < activePhysicsBodies.length; i++) {
              const physicsBody = activePhysicsBodies[i];
              physicsBody.update();
            }

            lastUpdateTime = now;
          }, STEP_MILLISECONDS);

          class Box extends EventEmitter {
            constructor({position, rotation, mass}) {
              super();

              this.position = position;
              this.rotation = rotation;
              this.mass = mass;

              this.spPhyiscs = false;
              this.mpPhyiscs = false;
              this.size = null;
              this.linearVelocity = null;
              this.angularVelocity = null;
              this.linearFactor = null;
              this.angularFactor = null;
              this.activationState = null;
              this.debug = false;

              this.body = null;
              this.debugMesh = null;
            }

            setSpPhysics(newValue) {
              this.spPhysics = newValue;

              this.render();
              this.renderDebug();
            }

            setMpPhysics(newValue) {
              this.mpPhyiscs = newValue;

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
                body.getCenterOfMassTransform(trans);
                trans.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
                body.setCenterOfMassTransform(trans);
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
                body.getCenterOfMassTransform(trans);
                trans.setRotation(new Ammo.btVector3(rotation.x, rotation.y, rotation.z, rotation.w));
                body.setCenterOfMassTransform(trans);
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
                body.setLinearVelocity(new Ammo.btVector3(linearVelocity.x, linearVelocity.y, linearVelocity.z));
              }
            }

            setAngularVelocity(angularVelocity) {
              this.angularVelocity = angularVelocity;

              const {body} = this;
              if (body) {
                body.setAngularVelocity(new Ammo.btVector3(angularVelocity.x, angularVelocity.y, angularVelocity.z));
              }
            }

            setLinearFactor(linearFactor) {
              this.linearFactor = linearFactor;

              const {body} = this;
              if (body) {
                body.setLinearFactor(new Ammo.btVector3(linearFactor.x, linearFactor.y, linearFactor.z));
              }
            }

            setAngularFactor(angularFactor) {
              this.angularFactor = angularFactor;

              const {body} = this;
              if (body) {
                body.setAngularFactor(new Ammo.btVector3(angularFactor.x, angularFactor.y, angularFactor.z));
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
                dynamicsWorld.removeRigidBody(body);

                activePhysicsBodies.splice(activePhysicsBodies.indexOf(this), 1);

                this.body = null;
              }

              const {spPhysics, mpPhysics, size} = this;
              if (spPhysics && !mpPhysics && size) {
                const body = (() => {
                  const {position, rotation} = this;

                  const halfSize = size.clone().multiplyScalar(0.5);
                  const colShape = new Ammo.btBoxShape(new Ammo.btVector3(halfSize.x, halfSize.y, halfSize.z));
                  const startTransform = new Ammo.btTransform();
                  startTransform.setIdentity();
                  startTransform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
                  startTransform.setRotation(new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w));

                  const {mass} = this;
                  const isDynamic = (mass !== 0);
                  const localInertia = new Ammo.btVector3(0, 0, 0);
                  if (isDynamic) {
                    colShape.calculateLocalInertia(mass, localInertia);
                  }

                  const myMotionState = new Ammo.btDefaultMotionState(startTransform);
                  const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, myMotionState, colShape, localInertia);
                  const body = new Ammo.btRigidBody(rbInfo);

                  const {linearVelocity, angularVelocity, linearFactor, angularFactor, activationState} = this;
                  if (linearVelocity) {
                    body.setLinearVelocity(new Ammo.btVector3(linearVelocity.x, linearVelocity.y, linearVelocity.z));
                  }
                  if (angularVelocity) {
                    body.setAngularVelocity(new Ammo.btVector3(angularVelocity.x, angularVelocity.y, angularVelocity.z));
                  }
                  if (linearFactor) {
                    body.setLinearFactor(new Ammo.btVector3(linearFactor.x, linearFactor.y, linearFactor.z));
                  }
                  if (angularFactor) {
                    body.setAngularFactor(new Ammo.btVector3(angularFactor.x, angularFactor.y, angularFactor.z));
                  }
                  if (activationState !== null) {
                    body.setActivationState(activationState);
                  }

                  dynamicsWorld.addRigidBody(body);

                  return body;
                })();
                this.body = body;

                activePhysicsBodies.push(this);
              }
            }

            renderDebug() {
              const {debugMesh: oldDebugMesh} = this;
              if (oldDebugMesh) {
                scene.remove(oldDebugMesh);
                this.debugMesh = null;
              }

              const {spPhysics, mpPhysics, debug, size} = this;
              if (spPhysics && mpPhysics && debug && size) {
                const newDebugMesh = _makeBoxDebugMesh({
                  dimensions: size,
                });
                const {position, rotation} = this;
                newDebugMesh.position.copy(position);
                newDebugMesh.quaternion.copy(rotation);

                scene.add(newDebugMesh);
                this.debugMesh = newDebugMesh;
              }
            }

            update() {
              const {body} = this;

              if (body.getMotionState()) {
                body.getMotionState().getWorldTransform(trans);
                const btOrigin = trans.getOrigin();
                const btRotation = trans.getRotation();

                const position = new THREE.Vector3(btOrigin.x(), btOrigin.y(), btOrigin.z());
                const quaternion = new THREE.Quaternion(btRotation.x(), btRotation.y(), btRotation.z(), btRotation.w());
                const scale = oneVector;

                this.emit('update', {
                  position,
                  quaternion,
                  scale,
                });

                const {debugMesh} = this;
                if (debugMesh) {
                  debugMesh.position.copy(position);
                  debugMesh.quaternion.copy(quaternion);
                  debugMesh.scale.copy(scale);
                }
              }
            }

            destroy() {
              const {body} = this;
              if (body) {
                dynamicsWorld.removeRigidBody(body);
                activePhysicsBodies.splice(activePhysicsBodies.indexOf(this), 1);
              }

              const {debugMesh} = this;
              if (debugMesh) {
                scene.remove(debugMesh);
              }
            }
          }
          class Compound extends EventEmitter {
            constructor({position, rotation, children, mass}) {
              super();

              this.position = position;
              this.rotation = rotation;
              this.children = children;
              this.mass = mass;

              this.spPhysics = false;
              this.mpPhysics = false;
              this.linearVelocity = null;
              this.angularVelocity = null;
              this.linearFactor = null;
              this.angularFactor = null;
              this.activationState = null;
              this.debug = false;

              this.body = null;
              this.debugMesh = null;
            }

            setSpPhysics(newValue) {
              this.spPhysics = newValue;

              this.render();
              this.renderDebug();
            }

            setMpPhysics(newValue) {
              this.mpPhyiscs = newValue;

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
                body.getCenterOfMassTransform(trans);
                trans.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
                body.setCenterOfMassTransform(trans);
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
                body.getCenterOfMassTransform(trans);
                trans.setRotation(new Ammo.btVector3(rotation.x, rotation.y, rotation.z, rotation.w));
                body.setCenterOfMassTransform(trans);
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
                body.setLinearVelocity(new Ammo.btVector3(linearVelocity.x, linearVelocity.y, linearVelocity.z));
              }
            }

            setAngularVelocity(angularVelocity) {
              this.angularVelocity = angularVelocity;

              const {body} = this;
              if (body) {
                body.setAngularVelocity(new Ammo.btVector3(angularVelocity.x, angularVelocity.y, angularVelocity.z));
              }
            }

            setLinearFactor(linearFactor) {
              this.linearFactor = linearFactor;

              const {body} = this;
              if (body) {
                body.setLinearFactor(new Ammo.btVector3(linearFactor.x, linearFactor.y, linearFactor.z));
              }
            }

            setAngularFactor(angularFactor) {
              this.angularFactor = angularFactor;

              const {body} = this;
              if (body) {
                body.setAngularFactor(new Ammo.btVector3(angularFactor.x, angularFactor.y, angularFactor.z));
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
                dynamicsWorld.removeRigidBody(body);

                activePhysicsBodies.splice(activePhysicsBodies.indexOf(this), 1);

                this.body = null;
              }

              const {spPhysics, mpPhysics, position, rotation} = this;
              if (spPhysics && !mpPhysics && position && rotation) {
                const body = (() => {
                  const {children, position, rotation} = this;

                  const compoundShape = (() => {
                    const compoundShape = new Ammo.btCompoundShape();

                    for (let i = 0; i < children.length; i++) {
                      const child = children[i];

                      const childTransform = (() => {
                        const {position = zeroVector, rotation = zeroQuaternion} = child;

                        const childTransform = new Ammo.btTransform();
                        childTransform.setIdentity();
                        childTransform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
                        childTransform.setRotation(new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w));

                        return childTransform;
                      })();
                      const childShape = (() => {
                        const {type} = child;

                        switch (type) {
                          case 'box': {
                            const {dimensions} = child;
                            const halfDimensions = dimensions.clone().multiplyScalar(0.5);
                            return new Ammo.btBoxShape(new Ammo.btVector3(halfDimensions.x, halfDimensions.y, halfDimensions.z));
                          }
                          default: {
                            return null;
                          }
                        }
                      })();
                      compoundShape.addChildShape(childTransform, childShape);
                    }

                    return compoundShape;
                  })();

                  const startTransform = new Ammo.btTransform();
                  startTransform.setIdentity();
                  if (position) {
                    startTransform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
                  }
                  if (rotation) {
                    startTransform.setRotation(new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w));
                  }

                  const {mass} = this;
                  const isDynamic = (mass !== 0);
                  const localInertia = new Ammo.btVector3(0, 0, 0);
                  if (isDynamic) {
                    compoundShape.calculateLocalInertia(mass, localInertia);
                  }

                  const myMotionState = new Ammo.btDefaultMotionState(startTransform);
                  const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, myMotionState, compoundShape, localInertia);
                  const body = new Ammo.btRigidBody(rbInfo);

                  const {linearVelocity, angularVelocity, linearFactor, angularFactor, activationState} = this;
                  if (linearVelocity) {
                    body.setLinearVelocity(new Ammo.btVector3(linearVelocity.x, linearVelocity.y, linearVelocity.z));
                  }
                  if (angularVelocity) {
                    body.setAngularVelocity(new Ammo.btVector3(angularVelocity.x, angularVelocity.y, angularVelocity.z));
                  }
                  if (linearFactor) {
                    body.setLinearFactor(new Ammo.btVector3(linearFactor.x, linearFactor.y, linearFactor.z));
                  }
                  if (angularFactor) {
                    body.setAngularFactor(new Ammo.btVector3(angularFactor.x, angularFactor.y, angularFactor.z));
                  }
                  if (activationState !== null) {
                    body.setActivationState(activationState);
                  }

                  dynamicsWorld.addRigidBody(body);

                  return body;
                })();
                this.body = body;

                activePhysicsBodies.push(this);
              }
            }

            renderDebug() {
              const {debugMesh: oldDebugMesh} = this;
              if (oldDebugMesh) {
                scene.remove(oldDebugMesh);
                this.debugMesh = null;
              }

              const {spPhysics, mpPhysics, debug} = this;
              if (spPhysics && !mpPhysics && debug) {
                const newDebugMesh = (() => {
                  const debugMesh = new THREE.Object3D();

                  const {children} = this;
                  for (let i = 0; i < children.length; i++) {
                    const child = children[i];

                    const childMesh = (() => {
                      const mesh = (() => {
                        const {type} = child;

                        switch (type) {
                          case 'box': {
                            const {dimensions} = child;
                            return _makeBoxDebugMesh({
                              dimensions,
                            });
                          }
                          default: {
                            return null;
                          }
                        }
                      })();

                      const {position = zeroVector, rotation = zeroQuaternion} = child;
                      mesh.position.copy(position);
                      mesh.rotation.copy(rotation);

                      return mesh;
                    })();

                    debugMesh.add(childMesh);
                  }

                  const {position, rotation} = this;
                  debugMesh.position.copy(position);
                  debugMesh.quaternion.copy(rotation);

                  return debugMesh;
                })();
                scene.add(newDebugMesh);
                this.debugMesh = newDebugMesh;
              }
            }

            update() {
              const {body} = this;

              if (body.getMotionState()) {
                body.getMotionState().getWorldTransform(trans);
                const btOrigin = trans.getOrigin();
                const btRotation = trans.getRotation();

                const position = new THREE.Vector3(btOrigin.x(), btOrigin.y(), btOrigin.z());
                const quaternion = new THREE.Quaternion(btRotation.x(), btRotation.y(), btRotation.z(), btRotation.w());
                const scale = oneVector;

                this.emit('update', {
                  position,
                  quaternion,
                  scale,
                });

                const {debugMesh} = this;
                if (debugMesh) {
                  debugMesh.position.copy(position);
                  debugMesh.quaternion.copy(quaternion);
                  debugMesh.scale.copy(scale);
                }
              }
            }

            destroy() {
              const {body} = this;
              if (body) {
                dynamicsWorld.removeRigidBody(body);
                activePhysicsBodies.splice(activePhysicsBodies.indexOf(this), 1);
              }

              const {debugMesh} = this;
              if (debugMesh) {
                scene.remove(debugMesh);
              }
            }
          }

          const _makeBoxDebugMesh = ({dimensions}) => {
            const geometry = new THREE.BoxBufferGeometry(dimensions.x, dimensions.y, dimensions.z);
            const material = wireframeMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          };

          // controllers
          const controllerMeshes = player.getControllerMeshes();
          const controllerPhysicsBodies = SIDES.map(side => {
            const controllerMesh = controllerMeshes[side];
            const {position, quaternion: rotation} = controllerMesh;
            const controllerPhysicsBody = new Compound({
              position,
              rotation,
              children: [
                {
                  type: 'box',
                  dimensions: new THREE.Vector3(0.115, 0.075, 0.215),
                  position: new THREE.Vector3(0, -(0.075 / 2), (0.215 / 2) - 0.045),
                },
              ],
              mass: 1,
            });
            controllerPhysicsBody.setLinearFactor(zeroVector);
            controllerPhysicsBody.setAngularFactor(zeroVector);
            controllerPhysicsBody.setLinearVelocity(zeroVector);
            controllerPhysicsBody.setAngularVelocity(zeroVector);
            controllerPhysicsBody.setActivationState(DISABLE_DEACTIVATION);
            controllerPhysicsBody.setSpPhysics(true);

            const _update = () => {
              controllerPhysicsBody.setPosition(controllerMesh.position);
              controllerPhysicsBody.setRotation(controllerMesh.quaternion);
            };
            render.on('update', _update)

            cleanups.push(() => {
              render.removeListener('update', _update)
            });

            return controllerPhysicsBody;
          });

          const spPhysicsComponent = {
            selector: '[sp-physics][size]',
            attributes: {
              'sp-physics': {
                type: 'checkbox',
                value: true,
              },
              'size': {
                type: 'vector',
                value: [1, 1, 1],
                min: 0.1,
                max: 1,
                step: 0.1,
              },
              'mp-physics': {
                type: 'checkbox',
                value: false,
              },
              'physics-debug': {
                type: 'checkbox',
                value: false,
              },
            },
            entityAddedCallback(entityElement) {
              const entityObject = entityElement.getObject();

              const {position, rotation} = _decomposeObjectMatrixWorld(entityObject);
              const physicsBody = new Box({
                position,
                rotation,
                mass: 1,
              });
              entityElement.setComponentApi(physicsBody);

              physicsBody.on('update', ({position, quaternion, scale}) => {
                entityElement.setState('position', position);
                entityElement.setState('quaternion', quaternion);
                entityElement.setState('scale', scale);
              });

              const _release = e => {
                const {detail: {linearVelocity, angularVelocity}} = e;

                physicsBody.setLinearVelocity(linearVelocity);
                physicsBody.setAngularVelocity(angularVelocity);
              };
              entityElement.addEventListener('release', _release);

              physicsBody.destroy = (destroy => () => {
                destroy();

                entityElement.removeEventListener('release', _release);
              })(physicsBody.destroy.bind(physicsBody));
            },
            entityRemovedCallback(entityElement) {
              const physicsBody = entityElement.getComponentApi();
              physicsBody.destroy();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const physicsBody = entityElement.getComponentApi();

              switch (name) {
                case 'sp-physics': {
                  physicsBody.setSpPhysics(newValue);

                  break;
                }
                case 'size': {
                  const size = new THREE.Vector3().fromArray(newValue);
                  physicsBody.setSize(size);

                  break;
                }
                case 'mp-physics': {
                  physicsBody.setMpPhysics(newValue);

                  break;
                }
                case 'physics-debug': {
                  physicsBody.setDebug(newValue);

                  const numPhysicsDebugs = (() => {
                    let result = 0;

                    for (let i = 0; i < activePhysicsBodies.length; i++) {
                      const physicsBody = activePhysicsBodies[i];
                      const {debug} = physicsBody;
                      result += Number(debug);
                    }

                    return result;
                  })();
                  const controllerPhysicsDebug = numPhysicsDebugs > 0;
                  for (let i = 0; i < controllerPhysicsBodies.length; i++) {
                    const controllerPhysicsBody = controllerPhysicsBodies[i];
                    controllerPhysicsBody.setDebug(controllerPhysicsDebug);
                  }

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
                case 'quaternion': {
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
          elements.registerComponent(this, spPhysicsComponent);

          cleanups.push(() => {
            elements.unregisterComponent(this, spPhysicsComponent);

            clearInterval(interval);

            setTimeout(() => { // allow physics bodies to destory themselves first
              Ammo.destroy(dynamicsWorld);
              Ammo.destroy(solver);
              Ammo.destroy(overlappingPairCache);
              Ammo.destroy(dispatcher);
              Ammo.destroy(collisionConfiguration)
            });
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZSpPhysics;
