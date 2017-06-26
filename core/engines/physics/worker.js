const Ammo = require('bllt');

const ACTIVE_TAG = 1;
const ISLAND_SLEEPING = 2;
const WANTS_DEACTIVATION = 3;
const DISABLE_DEACTIVATION = 4;
const DISABLE_SIMULATION = 5;

const FPS = 1000 / 60;
const TRANSFORM_AUX = new Ammo.btTransform();

const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
const broadphase = new Ammo.btDbvtBroadphase();
const solver = new Ammo.btSequentialImpulseConstraintSolver();
const physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));

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

    rigidBody.getMotionState().getWorldTransform(TRANSFORM_AUX);
    const pv = TRANSFORM_AUX.getOrigin();
    const p = [pv.x(), pv.y(), pv.z()];
    const qv = TRANSFORM_AUX.getRotation();
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

  setState(position, rotation) {
    const {rigidBody} = this;

    TRANSFORM_AUX.setIdentity();
    TRANSFORM_AUX.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
    TRANSFORM_AUX.setRotation(new Ammo.btQuaternion(rotation[0], rotation[1], rotation[2], rotation[3]));

    rigidBody.setCenterOfMassTransform(TRANSFORM_AUX);
    rigidBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
    rigidBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
    rigidBody.activate();
  }

  clearCache() {
    this._lastUpdate = null;
  }
}

const _removeBody = (body, bodyIndex) => {
  const {rigidBody} = body;
  physicsWorld.removeRigidBody(rigidBody);

  bodies.splice(bodyIndex, 1);
};

process.on('message', m => {
  const {method, args} = m;

  switch (method) {
    case 'add': {
      const [id, type, spec, position, rotation, mass, owner] = args;

      switch (type) {
        case 'box': {
          if (!bodies.some(body => body.id === id)) {
            const boxShape = new Ammo.btBoxShape(new Ammo.btVector3(spec[0] / 2, spec[1] / 2, spec[2] / 2));
            const boxTransform = TRANSFORM_AUX;
            boxTransform.setIdentity();
            boxTransform.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
            boxTransform.setRotation(new Ammo.btQuaternion(rotation[0], rotation[1], rotation[2], rotation[3]));
            const boxMass = mass;
            const boxLocalInertia = new Ammo.btVector3(0, 0, 0);
            boxShape.calculateLocalInertia(boxMass, boxLocalInertia);
            const boxMotionState = new Ammo.btDefaultMotionState(boxTransform);
            const boxBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(boxMass, boxMotionState, boxShape, boxLocalInertia));
            physicsWorld.addRigidBody(boxBody);
            
            const body = new Body(id, boxBody, owner);
            bodies.push(body);
          }
          break;
        }
        case 'plane': {
          if (!bodies.some(body => body.id === id)) {
            const planeShape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(spec[0], spec[1], spec[2]), spec[3]);
            const planeTransform = TRANSFORM_AUX;
            planeTransform.setIdentity();
            planeTransform.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
            planeTransform.setRotation(new Ammo.btQuaternion(rotation[0], rotation[1], rotation[2], rotation[3]));
            const planeMass = mass;
            const planeLocalInertia = new Ammo.btVector3(0, 0, 0);
            const planeMotionState = new Ammo.btDefaultMotionState(planeTransform);
            const planeBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(planeMass, planeMotionState, planeShape, planeLocalInertia));
            physicsWorld.addRigidBody(planeBody);

            const body = new Body(id, planeBody, owner);
            bodies.push(body);
          }
          break;
        }
        default: {
          console.warn('invalid body type:', JSON.stringify(type));
          break;
        }
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
      const [id, position, rotation] = args;
      const body = bodies.find(body => body.id === id);

      if (body) {
        body.setState(position, rotation);
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
    case 'clearCache': {
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        body.clearCache();
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

let lastTime = Date.now();
const interval = setInterval(() => {
  const now = Date.now();
  const dt = (now - lastTime) / 1000;
  physicsWorld.stepSimulation(dt, 2);

  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    const update = body.getUpdate();

    if (update !== null) {
      process.send(update);
    }
  }

  lastTime = now;
}, FPS);
