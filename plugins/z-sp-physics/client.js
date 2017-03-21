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
          const {three: {THREE}, elements} = zeo;

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
            const groundShape = new Ammo.btBoxShape(new Ammo.btVector3(50, 50, 50));
            const groundTransform = new Ammo.btTransform();
            groundTransform.setIdentity();
            groundTransform.setOrigin(new Ammo.btVector3(0, -56, 0));

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

          const bodies = [];

          let lastUpdateTime = Date.now();
          const trans = new Ammo.btTransform();
          const interval = setInterval(() => {
            const now = Date.now();
            const timeDiff = now - lastUpdateTime;
            dynamicsWorld.stepSimulation(timeDiff, RESOLUTION, STEP_SECONDS / RESOLUTION);

            for (let i = 0; i < bodies.length; i++) {
              const body = bodies[i];

              if (body.getMotionState()) {
                body.getMotionState().getWorldTransform(trans);
                const origin = trans.getOrigin();
                const rotation = trans.getRotation();

                const position = new THREE.Vector3(origin.x(), origin.y(), origin.z());
                const quaternion = new THREE.Quaternion(rotation.x(), rotation.y(), rotation.z(), rotation.w());
                console.log("world pos = " + position.toArray().concat(quaternion.toArray()).join('.'));
              }
            }

            lastUpdateTime = now;
          }, STEP_MILLISECONDS);

          class BoxPhysicsBody {
            constructor(element, object) {
              this.element = element;
              this.object = object;

              this.body = null;
            }

            setSpPhysics(newValue) {
              if (newValue) {
                const body = (() => {
                  const colShape = new Ammo.btSphereShape(1);
                  const startTransform = new Ammo.btTransform();
                  startTransform.setIdentity();

                  const mass = 1;
                  const isDynamic = (mass !== 0);
                  const localInertia = new Ammo.btVector3(0, 0, 0);

                  if (isDynamic) {
                    colShape.calculateLocalInertia(mass,localInertia);
                  }

                  startTransform.setOrigin(new Ammo.btVector3(2, 10, 0));

                  const  myMotionState = new Ammo.btDefaultMotionState(startTransform);
                  const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, myMotionState, colShape, localInertia);
                  const body = new Ammo.btRigidBody(rbInfo);

                  dynamicsWorld.addRigidBody(body);

                  bodies.push(body);

                  return body;
                })();
                this.body = body;
              } else {
                const {body} = this;
                dynamicsWorld.removeRigidBody(body);

                bodies.splice(bodies.indexOf(body), 1);

                this.body = null;
              }
            }

            destroy() {
              const {body} = this;

              if (body) {
                dynamicsWorld.removeRigidBody(body);

                bodies.splice(bodies.indexOf(body), 1);

                this.body = null;
              }
            }
          }

          const _makeBody = (element, object) => new BoxPhysicsBody(element, object);

          const spPhysicsComponent = {
            selector: '[sp-physics]',
            attributes: {
              'sp-physics': {
                type: 'checkbox',
                value: true,
              },
            },
            entityAddedCallback(entityElement) {
              const physicsBody = _makeBody(entityElement, entityElement.getObject());
              entityElement.setComponentApi(physicsBody);
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
            }
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
