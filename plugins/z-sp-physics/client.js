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
            constructor(object, size) {
              super();

              this.object = object;
              this.size = size;

              this.body = null;
            }

            setSpPhysics(newValue) {
              if (newValue) {
                const body = (() => {
                  const {object, size} = this;
                  const {position, rotation} = _decomposeObjectMatrixWorld(object);
                  const boundingBox = new THREE.Box3()
                    .setFromObject(object);

                  const colShape = new Ammo.btBoxShape(new Ammo.btVector3(size.x, size.y, size.z));
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
              } else {
                const {body} = this;
                dynamicsWorld.removeRigidBody(body);

                activePhysicsBodies.splice(activePhysicsBodies.indexOf(this), 1);

                this.body = null;
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

                this.emit('update', {
                  position,
                  quaternion,
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

          const _makeBoxBody = (object, size) => new BoxPhysicsBody(object, size.clone().multiplyScalar(0.5));

          const spPhysicsComponent = {
            selector: '[sp-physics]',
            attributes: {
              'sp-physics': {
                type: 'checkbox',
                value: true,
              },
            },
            entityAddedCallback(entityElement) {
              const entityObject = entityElement.getObject();

              // XXX
              const debugMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
                const material = new THREE.MeshPhongMaterial({
                  color: 0xFF0000,
                  // shading: THREE.FlatShading,
                });

                const mesh = new THREE.Mesh(geometry, material);
                return mesh;
              })();
              entityObject.add(debugMesh);
              entityObject.position.set(0, 15, 0);
              entityObject.quaternion.setFromEuler(new THREE.Euler(Math.PI / 4, 0, Math.PI / 4, camera.rotation.order));
              entityObject.updateMatrixWorld();

              const physicsBody = _makeBoxBody(entityObject, new THREE.Vector3(1, 1, 1));
              entityElement.setComponentApi(physicsBody);

              physicsBody.on('update', ({position, quaternion}) => {
                entityElement.setState({
                  position,
                  quaternion,
                });
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
                  physicsBody.setSpPhysics(newValue);

                  break;
                }
              }
            },
            entityStateChangedCallback(entityElement, oldValue, newValue) {
              const {position, quaternion} = newValue;
              const entityObject = entityElement.getObject();

              entityObject.position.copy(position);
              entityObject.quaternion.copy(quaternion);
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
