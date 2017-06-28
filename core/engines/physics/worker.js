const Ammo = require('bllt');

const ACTIVE_TAG = 1;
const ISLAND_SLEEPING = 2;
const WANTS_DEACTIVATION = 3;
const DISABLE_DEACTIVATION = 4;
const DISABLE_SIMULATION = 5;

const FPS = 1000 / 90;
const FIXED_TIME_STEP = 1 / 200;
const BT_VECTOR3 = new Ammo.btVector3();
const BT_TRANSFORM = new Ammo.btTransform();
const BT_QUATERNION = new Ammo.btQuaternion();

const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
const broadphase = new Ammo.btDbvtBroadphase();
const solver = new Ammo.btSequentialImpulseConstraintSolver();
const physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
physicsWorld.setGravity(new Ammo.btVector3(0, -9.8, 0));

const bodies = [];

class Body {
  constructor(id, rigidBody, owner) {
    this.id = id;
    this.rigidBody = rigidBody;
    this.owner = owner;

    this._lastUpdate = null;
  }

  getUpdate() {
    const {id, rigidBody, _lastUpdate: lastUpdate} = this;

    rigidBody.getMotionState().getWorldTransform(BT_TRANSFORM);
    const pv = BT_TRANSFORM.getOrigin();
    const p = [pv.x(), pv.y(), pv.z()];
    const qv = BT_TRANSFORM.getRotation();
    const q = [qv.x(), qv.y(), qv.z(), qv.w()];

    if (lastUpdate === null || !_arrayEquals(lastUpdate.position, p) || !_arrayEquals(lastUpdate.rotation, q)) {
      const newUpdate = {
        id: id,
        position: p,
        rotation: q,
      };
      this._lastUpdate = newUpdate;

      return newUpdate;
    } else {
      return null;
    }
  }

  setState(position, rotation, linearVelocity, angularVelocity, activate) {
    const {rigidBody} = this;

    BT_TRANSFORM.setIdentity();

    BT_VECTOR3.setX(position[0]);
    BT_VECTOR3.setY(position[1]);
    BT_VECTOR3.setZ(position[2]);
    BT_TRANSFORM.setOrigin(BT_VECTOR3);

    BT_QUATERNION.setX(rotation[0]);
    BT_QUATERNION.setY(rotation[1]);
    BT_QUATERNION.setZ(rotation[2]);
    BT_QUATERNION.setW(rotation[3]);
    BT_TRANSFORM.setRotation(BT_QUATERNION);

    rigidBody.setCenterOfMassTransform(BT_TRANSFORM);

    BT_VECTOR3.setX(linearVelocity[0]);
    BT_VECTOR3.setY(linearVelocity[1]);
    BT_VECTOR3.setZ(linearVelocity[2]);
    rigidBody.setLinearVelocity(BT_VECTOR3);

    BT_VECTOR3.setX(angularVelocity[0]);
    BT_VECTOR3.setY(angularVelocity[1]);
    BT_VECTOR3.setZ(angularVelocity[2]);
    rigidBody.setAngularVelocity(BT_VECTOR3);

    if (activate) {
      rigidBody.activate();
    }
  }

  clearCache() {
    this._lastUpdate = null;
  }
}

const _addBody = body => {
  const {rigidBody} = body;
  physicsWorld.addRigidBody(rigidBody);

  bodies.push(body);

  if (bodies.length === 1) {
    _start();
  }
};

const _removeBody = (body, bodyIndex) => {
  const {rigidBody} = body;
  physicsWorld.removeRigidBody(rigidBody);

  bodies.splice(bodyIndex, 1);

  if (bodies.length === 0) {
    _stop();
  }
};

process.on('message', m => {
  const {method, args} = m;

  switch (method) {
    case 'add': {
      const [id, type, spec, position, rotation, mass, linearFactor, angularFactor, disableDeactivation, owner] = args;

      const body = bodies.find(body => body.id === id);
      if (!body) {
        switch (type) {
          case 'box': {
            const boxShape = new Ammo.btBoxShape(new Ammo.btVector3(spec[0] / 2, spec[1] / 2, spec[2] / 2));
            const boxTransform = BT_TRANSFORM;
            boxTransform.setIdentity();
            boxTransform.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
            boxTransform.setRotation(new Ammo.btQuaternion(rotation[0], rotation[1], rotation[2], rotation[3]));
            const boxMass = mass;
            const boxLocalInertia = new Ammo.btVector3(0, 0, 0);
            boxShape.calculateLocalInertia(boxMass, boxLocalInertia);
            const boxMotionState = new Ammo.btDefaultMotionState(boxTransform);
            const boxBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(boxMass, boxMotionState, boxShape, boxLocalInertia));
            boxBody.setLinearFactor(new Ammo.btVector3(linearFactor[0], linearFactor[1], linearFactor[2]));
            boxBody.setAngularFactor(new Ammo.btVector3(angularFactor[0], angularFactor[1], angularFactor[2]));
            if (disableDeactivation) {
              boxBody.setActivationState(DISABLE_DEACTIVATION);
            }
            
            const body = new Body(id, boxBody, owner);
            _addBody(body);
            break;
          }
          case 'plane': {
            const planeShape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(spec[0], spec[1], spec[2]), spec[3]);
            const planeTransform = BT_TRANSFORM;
            planeTransform.setIdentity();
            planeTransform.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
            planeTransform.setRotation(new Ammo.btQuaternion(rotation[0], rotation[1], rotation[2], rotation[3]));
            const planeMass = mass;
            const planeLocalInertia = new Ammo.btVector3(0, 0, 0);
            const planeMotionState = new Ammo.btDefaultMotionState(planeTransform);
            const planeBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(planeMass, planeMotionState, planeShape, planeLocalInertia));
            planeBody.setLinearFactor(new Ammo.btVector3(linearFactor[0], linearFactor[1], linearFactor[2]));
            planeBody.setAngularFactor(new Ammo.btVector3(angularFactor[0], angularFactor[1], angularFactor[2]));
            if (disableDeactivation) {
              planeBody.setActivationState(DISABLE_DEACTIVATION);
            }

            const body = new Body(id, planeBody, owner);
            _addBody(body);
            break;
          }
          case 'compound': {
            const compoundShape = new Ammo.btCompoundShape();
            const childSpecs = spec;
            for (let i = 0; i < childSpecs.length; i++) {
              const childSpec = childSpecs[i];
              const [type, spec, position, rotation, mass] = childSpec;

              switch (type) {
                case 'box': {
                  const boxShape = new Ammo.btBoxShape(new Ammo.btVector3(spec[0] / 2, spec[1] / 2, spec[2] / 2));
                  const boxTransform = new Ammo.btTransform();
                  boxTransform.setIdentity();
                  boxTransform.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
                  boxTransform.setRotation(new Ammo.btQuaternion(rotation[0], rotation[1], rotation[2], rotation[3]));
                  compoundShape.addChildShape(boxTransform, boxShape);
                  break;
                }
                default: {
                  console.warn('invalid child type:', JSON.stringify(type));
                  break;
                }
              }
            }

            const compoundTransform = BT_TRANSFORM;
            compoundTransform.setIdentity();
            compoundTransform.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
            compoundTransform.setRotation(new Ammo.btQuaternion(rotation[0], rotation[1], rotation[2], rotation[3]));
            const compoundMass = mass;
            const compoundLocalInertia = new Ammo.btVector3(0, 0, 0);
            compoundShape.calculateLocalInertia(compoundMass, compoundLocalInertia);
            const compoundMotionState = new Ammo.btDefaultMotionState(compoundTransform);
            const compoundBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(compoundMass, compoundMotionState, compoundShape, compoundLocalInertia));
            compoundBody.setLinearFactor(new Ammo.btVector3(linearFactor[0], linearFactor[1], linearFactor[2]));
            compoundBody.setAngularFactor(new Ammo.btVector3(angularFactor[0], angularFactor[1], angularFactor[2]));
            if (disableDeactivation) {
              compoundBody.setActivationState(DISABLE_DEACTIVATION);
            }

            const body = new Body(id, compoundBody, owner);
            _addBody(body);
            break;
          }
          default: {
            console.warn('invalid body type:', JSON.stringify(type));
            break;
          }
        }
      } else {
        body.clearCache();
      }
      break;
    }
    case 'remove': {
      const [id] = args;
      const bodyIndex = bodies.findIndex(body => body.id === id);

      if (bodyIndex !== -1) {
        const body = bodies[bodyIndex];

        _removeBody(body, bodyIndex);
      }
      break;
    }
    case 'setState': {
      const [id, position, rotation, linearVelocity, anguilarVelocity, activate] = args;
      const body = bodies.find(body => body.id === id);

      if (body) {
        body.setState(position, rotation, linearVelocity, anguilarVelocity, activate);
      }
      break;
    }
    case 'removeOwner': {
      const [owner] = args;

      const oldBodies = bodies.slice();
      for (let i = 0; i < oldBodies.length; i++) {
        const body = oldBodies[i];

        if (body.owner === owner) {
          _removeBody(body, i);
        }
      }
      break;
    }
    default: {
      console.warn('invalid message type:', JSON.stringify(method));
      break;
    }
  }
});

const _arrayEquals = (a, b) => {
  if (a.length === b.length) {
    for (let i = 0; i < a.length; i++) {
      const ai = a[i];
      const bi = b[i];

      if (ai !== bi) {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
};

let interval = null;
let lastTime = 0;
const _start = () => {
  interval = setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    physicsWorld.stepSimulation(dt, 5, FIXED_TIME_STEP);

    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      const update = body.getUpdate();

      if (update !== null) {
        process.send(update);
      }
    }

    lastTime = now;
  }, FPS);
  lastTime = Date.now();
};
const _stop = () => {
  clearInterval(interval);
  interval = null;
  lastTime = 0;
};
