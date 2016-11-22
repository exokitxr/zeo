const physics = require('./build/Release/physics.node');

const FPS = 120;
const STEP_SECONDS = 1 / FPS;
const STEP_MILLISECONDS = 1000 / FPS;

const worlds = new Map();
const bodies = new Map();

class BodyRecord {
  constructor(world, body) {
    this.world = world;
    this.body = body;
  }
}

const _requestUpdate = () => {
  const updates = [];

  bodies.forEach((bodyRecord, bodyId) => {
    const {body} = bodyRecord;
    const position = body.getPosition();
    const rotation = body.getRotation();
    const linearVelocity = body.getLinearVelocity();
    const angularVelocity = body.getAngularVelocity();

    const update = {
      id: bodyId,
      position,
      rotation,
      linearVelocity,
      angularVelocity,
    };
    updates.push(update);
  });

  send('update', updates);
};
let interval = null;
const _start = () => {
  _stop();

  interval = setInterval(() => {
    worlds.forEach(world => {
      world.stepSimulation(STEP_SECONDS, 1, STEP_SECONDS);
    });
  }, STEP_MILLISECONDS);
};
const _stop = () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
};
const _addWorld = ({id}) => {
  const world = new physics.World();
  worlds.set(id, world);
};
const _removeWorld = ({id}) => {
  worlds.remove(id);
};
const _addBody = ({worldId, body: bodySpec}) => {
  const world = worlds.get(worldId);
  const body = _makeBody(bodySpec);

  world.addRigidBody(body);

  const {id: bodyId} = bodySpec;
  const bodyRecord = new BodyRecord(world, body);
  bodies.set(bodyId, bodyRecord);
};
const _removeBody = ({bodyId}) => {
  const bodyRecord = bodies.get(bodyId);
  const {world, body} = bodyRecord;

  world.removeRigidBody(body);

  bodies.delete(bodyId);
};
const _setPosition = ({bodyId, position}) => {
  const bodyRecord = bodies.get(bodyId);
  const {body} = bodyRecord;

  const [x, y, z] = position;
  body.setPosition(x, y, z);
};
const _setRotation = ({bodyId, rotation}) => {
  const bodyRecord = bodies.get(bodyId);
  const {body} = bodyRecord;

  const [x, y, z, w] = rotation;
  body.setRotation(x, y, z, w);
};

const _makeBody = bodySpec => {
  const {type} = bodySpec;

  switch (type) {
    case 'plane': {
      const {dimensions, mass, position, rotation} = bodySpec;

      const plane = physics.RigidBody.make({
        type: physics.RigidBody.PLANE,
        dimensions,
        mass,
      });
      if (position) {
        plane.setPosition(position[0], position[1], position[2]);
      }
      if (rotation) {
        plane.setRotation(rotation[0], rotation[1], rotation[2], rotation[3]);
      }

      return plane;
    }
    case 'box': {
      const {dimensions, mass, position, rotation} = bodySpec;

      const box = physics.RigidBody.make({
        type: physics.RigidBody.BOX,
        dimensions,
        mass,
      });
      if (position) {
        box.setPosition(position[0], position[1], position[2]);
      }
      if (rotation) {
        box.setRotation(rotation[0], rotation[1], rotation[2], rotation[3]);
      }

      return box;
    }
    case 'sphere': {
      const {size, mass, position, rotation} = bodySpec;

      const sphere = physics.RigidBody.make({
        type: physics.RigidBody.SPHERE,
        size,
        mass,
      });
      if (position) {
        sphere.setPosition(position[0], position[1], position[2]);
      }
      if (rotation) {
        sphere.setRotation(rotation[0], rotation[1], rotation[2], rotation[3]);
      }

      return sphere;
    }
    case 'convexHull': {
      const {size, points, position, rotation} = bodySpec;

      const convexHull = physics.RigidBody.make({
        type: physics.RigidBody.CONVEX_HULL,
        convexHull,
        mass,
      });
      if (position) {
        convexHull.setPosition(position[0], position[1], position[2]);
      }
      if (rotation) {
        convexHull.setRotation(rotation[0], rotation[1], rotation[2], rotation[3]);
      }

      return convexHull;
    }
    case 'triangleMesh': {
      const {size, points, position, rotation} = bodySpec;

      const triangleMesh = physics.RigidBody.make({
        type: physics.RigidBody.CONVEX_HULL,
        points,
        mass,
      });
      if (position) {
        triangleMesh.setPosition(position[0], position[1], position[2]);
      }
      if (rotation) {
        triangleMesh.setRotation(rotation[0], rotation[1], rotation[2], rotation[3]);
      }
    }
    default:
      return null;
  }
};

process.on('message', m => {
  const {type} = m;

  switch (type) {
    case 'requestUpdate':
      _requestUpdate();
      break;
    case 'start':
      _start();
      break;
    case 'stop':
      _stop();
    case 'addWorld': {
      const {args: {id}} = m;
      _addWorld({id});
      break;
    }
    case 'removeWorld': {
      const {id} = m;
      _removeWorld({id});
      break;
    }
    case 'addBody': {
      const {args: {worldId, body}} = m;
      _addBody({worldId, body});
      break;
    }
    case 'removeBody': {
      const {args: {bodyId}} = m;
      _removeBody({bodyId});
      break;
    }
    case 'setPosition': {
      const {args: {bodyId, position}} = m;
      _setPosition({bodyId, position});
      break;
    }
    case 'setRotation': {
      const {args: {bodyId, rotation}} = m;
      _setRotation({bodyId, rotation});
      break;
    }
    default:
      console.warn('unknown message type:', JSON.stringify(type));
      break;
  }
});

const send = (type, data) => {
  process.send({
    type,
    data,
  });
};

// console.log(physics);
