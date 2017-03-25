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
          const {three: {THREE, camera}, player, render, elements, utils: {js: {events: {EventEmitter}}}} = zeo;

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
            constructor({object, mass}) {
              super();

              this.object = object;
              this.mass = mass;

              this.enabled = false;
              this.size = null;
              this.position = null;
              this.rotation = null;
              this.linearVelocity = null;
              this.angularVelocity = null;
              this.linearFactor = null;
              this.angularFactor = null;
              this.activationState = null;
              this.debug = false;

              this.body = null;
              this.debugMesh = null;
            }

            setEnabled(newValue) {
              this.enabled = newValue;

              this.render();
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
            }

            setRotation(rotation) {
              this.rotation = rotation;

              const {body} = this;
              if (body) {
                body.getCenterOfMassTransform(trans);
                trans.setRotation(new Ammo.btVector3(rotation.x, rotation.y, rotation.z, rotation.w));
                body.setCenterOfMassTransform(trans);
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

              const {enabled, size} = this;
              if (enabled && size) {
                const body = (() => {
                  const {object} = this;
                  const {position: objectPosition, rotation: objectRotation} = _decomposeObjectMatrixWorld(object);
                  const {position: localPosition, rotation: localRotation} = this;
                  const position = localPosition || objectPosition;
                  const rotation = localRotation || objectRotation;

                  const halfSize = size.map(v => v * 0.5);
                  const colShape = new Ammo.btBoxShape(new Ammo.btVector3(halfSize[0], halfSize[1], halfSize[2]));
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
              const {object, debugMesh: oldDebugMesh} = this;

              if (oldDebugMesh) {
                object.remove(oldDebugMesh);
                this.debugMesh = null;
              }

              const {debug, size} = this;
              if (debug && size) {
                const newDebugMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(size[0], size[1], size[2]);
                  const material = wireframeMaterial;

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                object.add(newDebugMesh);
                this.debugMesh = newDebugMesh;
              }
            }

            update() {
              const {body, size} = this;

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
              }
            }

            destroy() {
              const {body} = this;

              if (body) {
                dynamicsWorld.removeRigidBody(body);

                activePhysicsBodies.splice(activePhysicsBodies.indexOf(this), 1);

                this.body = null;
              }
            }
          }
          class Compound extends EventEmitter {
            constructor({object, children, mass}) {
              super();

              this.object = object;
              this.children = children;
              this.mass = mass;

              this.enabled = false;
              this.position = null;
              this.rotation = null;
              this.linearVelocity = null;
              this.angularVelocity = null;
              this.linearFactor = null;
              this.angularFactor = null;
              this.activationState = null;
              this.debug = false;

              this.body = null;
              this.debugMesh = null;
            }

            setEnabled(newValue) {
              this.enabled = newValue;

              this.render();
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
            }

            setRotation(rotation) {
              this.rotation = rotation;

              const {body} = this;
              if (body) {
                body.getCenterOfMassTransform(trans);
                trans.setRotation(new Ammo.btVector3(rotation.x, rotation.y, rotation.z, rotation.w));
                body.setCenterOfMassTransform(trans);
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

              const {enabled} = this;
              if (enabled) {
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
                            return new Ammo.btBoxShape(new Ammo.btVector3(dimensions.x, dimensions.y, dimensions.z));
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
              const {object, children, debugMesh: oldDebugMesh} = this;

              if (oldDebugMesh) {
                object.remove(oldDebugMesh);
                this.debugMesh = null;
              }

              const {debug} = this;
              if (debug) {
                const newDebugMesh = (() => {
                  const debugMesh = new THREE.Object3D();

                  for (let i = 0; i < children.length; i++) {
                    const child = children[i];

                    const childMesh = (() => {
                      const mesh = (() => {
                        const {type} = child;

                        switch (type) {
                          case 'box': {
                            const {dimensions} = child;

                            const geometry = new THREE.BoxBufferGeometry(dimensions.x, dimensions.y, dimensions.z);
                            const material = wireframeMaterial;

                            const mesh = new THREE.Mesh(geometry, material);
                            return mesh;
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

                  return debugMesh;
                })();
                object.add(newDebugMesh);
                this.debugMesh = newDebugMesh;
              }
            }

            update() {
              const {body, size} = this;

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
              }
            }

            destroy() {
              const {body} = this;

              if (body) {
                dynamicsWorld.removeRigidBody(body);

                activePhysicsBodies.splice(activePhysicsBodies.indexOf(this), 1);

                this.body = null;
              }
            }
          }

          const _makeBoxBody = spec => new Box(spec);
          const _makeCompoundBody = spec => new Compound(spec);

          // controllers
          const controllerMeshes = player.getControllerMeshes();
          const controllerPhysicsBodies = SIDES.map(side => {
            const controllerMesh = controllerMeshes[side];
            const controllerPhysicsBody = _makeCompoundBody({
              object: controllerMesh,
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
            controllerPhysicsBody.setEnabled(true);

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
              'physics-debug': {
                type: 'checkbox',
                value: false,
              },
            },
            entityAddedCallback(entityElement) {
              const entityObject = entityElement.getObject();

              const physicsBody = _makeBoxBody({
                object: entityObject,
                mass: 1,
              });
              entityElement.setComponentApi(physicsBody);

              physicsBody.debugMesh = null;

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
                  physicsBody.setEnabled(newValue);

                  break;
                }
                case 'size': {
                  physicsBody.setSize(newValue);

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

            setTimeout(() => { // destroy physics bodies first
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
