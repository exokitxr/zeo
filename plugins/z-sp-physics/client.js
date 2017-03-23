const FPS = 60;
const RESOLUTION = 4;
const STEP_SECONDS = 1 / FPS;
const STEP_MILLISECONDS = 1000 / FPS;

class ZPhysics {
  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

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
          const {three: {THREE, camera}, elements, utils: {js: {events: {EventEmitter}}}} = zeo;

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            // shading: THREE.FlatShading,
          });

          const oneVector = new THREE.Vector3(1, 1, 1);

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

          class BoxPhysicsBody extends EventEmitter {
            constructor(object) {
              super();

              this.object = object;

              this.enabled = false;
              this.size = null;
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
                  const {position, rotation} = _decomposeObjectMatrixWorld(object);
                  const boundingBox = new THREE.Box3()
                    .setFromObject(object);

                  const halfSize = size.map(v => v * 0.5);
                  const colShape = new Ammo.btBoxShape(new Ammo.btVector3(halfSize[0], halfSize[1], halfSize[2]));
                  const startTransform = new Ammo.btTransform();
                  startTransform.setIdentity();
                  startTransform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
                  startTransform.setRotation(new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w));

                  const mass = 1;
                  const isDynamic = (mass !== 0);
                  const localInertia = new Ammo.btVector3(0, 0, 0);

                  if (isDynamic) {
                    colShape.calculateLocalInertia(mass, localInertia);
                  }

                  const myMotionState = new Ammo.btDefaultMotionState(startTransform);
                  const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, myMotionState, colShape, localInertia);
                  const body = new Ammo.btRigidBody(rbInfo);

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
                object.debugMesh = null;
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

          const _makeBoxBody = object => new BoxPhysicsBody(object);

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

              const physicsBody = _makeBoxBody(entityObject);
              entityElement.setComponentApi(physicsBody);

              physicsBody.debugMesh = null;

              physicsBody.on('update', ({position, quaternion, scale}) => {
                entityElement.setState('position', position);
                entityElement.setState('quaternion', quaternion);
                entityElement.setState('scale', scale);
              });
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

          this._cleanup = () => {
            elements.unregisterComponent(this, spPhysicsComponent);

            clearInterval(interval);

            Ammo.destroy(dynamicsWorld);
            Ammo.destroy(solver);
            Ammo.destroy(overlappingPairCache);
            Ammo.destroy(dispatcher);
            Ammo.destroy(collisionConfiguration);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZPhysics;
