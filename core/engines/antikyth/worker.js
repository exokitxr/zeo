const physics = require('./build/Release/physics.node');

const FPS = 120;
const STEP_SECONDS = 1 / FPS;
const STEP_MILLISECONDS = 1000 / FPS;

const worlds = new Map(); // worldId -> World
const bodies = new Map(); // bodyId -> Body
const worldBodyIndex = new Map(); // worldId -> [bodyId]
const bodyWorldIndex = new Map(); // bodyId -> worldId

class BodyRecord {
  constructor(world, body) {
    this.world = world;
    this.body = body;
  }
}

const _requestUpdate = worldId => {
  const bodyIds = worldBodyIndex.get(worldId);
  const updates = bodyIds.map(bodyId => {
    const body = bodies.get(bodyId);

    const position = body.getPosition();
    const rotation = body.getRotation();
    const linearVelocity = body.getLinearVelocity();
    const angularVelocity = body.getAngularVelocity();

    return {
      id: bodyId,
      position,
      rotation,
      linearVelocity,
      angularVelocity,
    };
  });

  if (updates.length > 0) {
    send('update', {
      id: worldId,
      updates,
    });
  }
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

  worldBodyIndex.set(id, []);
};
const _removeWorld = ({id}) => {
  worlds.delete(id);

  const worldBodyIds = worldBodyIndex.get(id);
  for (let i = 0; i < worldBodyIds.length; i++) {
    const bodyId = worldBodyIds[i];

    bodies.delete(bodyId);
    bodyWorldIndex.delete(bodyId);
  }

  worldBodyIndex.delete(id);
};
const _addBody = ({worldId, body: bodySpec}) => {
  const body = _makeBody(bodySpec);
  const {id: bodyId} = bodySpec;
  bodies.set(bodyId, body);

  const world = worlds.get(worldId);
  world.addRigidBody(body);

  const worldBodyIds = worldBodyIndex.get(worldId);
  worldBodyIds.push(bodyId);

  bodyWorldIndex.set(bodyId, worldId);
};
const _removeBody = ({bodyId}) => {
  const body = bodies.get(bodyId);

  const worldId = bodyWorldIndex.get(bodyId);
  const world = worlds.get(worldId);
  world.removeRigidBody(body);

  bodies.delete(bodyId);
  const worldBodyIds = worldBodyIndex.get(worldId);
  worldBodyIds.splice(worldBodyIds.indexOf(bodyId), 1);
  bodyWorldIndex.delete(bodyId);
};
const _setPosition = ({bodyId, position}) => {
  const body = bodies.get(bodyId);

  const [x, y, z] = position;
  body.setPosition(x, y, z);
};
const _setRotation = ({bodyId, rotation}) => {
  const body = bodies.get(bodyId);

  const [x, y, z, w] = rotation;
  body.setRotation(x, y, z, w);
};
const _setLinearVelocity = ({bodyId, linearVelocity}) => {
  const body = bodies.get(bodyId);

  const [x, y, z] = linearVelocity;
  body.setLinearVelocity(x, y, z);
};
const _setAngularVelocity = ({bodyId, angularVelocity}) => {
  const body = bodies.get(bodyId);

  const [x, y, z] = angularVelocity;
  body.setAngularVelocity(x, y, z);
};

const _makeBody = bodySpec => {
  const {type} = bodySpec;

  switch (type) {
    case 'plane': {
      const {dimensions, scale, mass, position, rotation} = bodySpec;

      const plane = physics.RigidBody.make({
        type: physics.RigidBody.PLANE,
        dimensions,
        scale,
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
      const {dimensions, scale, mass, position, rotation} = bodySpec;

      const box = physics.RigidBody.make({
        type: physics.RigidBody.BOX,
        dimensions,
        scale,
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
      const {size, mass, scale, position, rotation} = bodySpec;

      const sphere = physics.RigidBody.make({
        type: physics.RigidBody.SPHERE,
        size,
        scale,
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
      const {points, scale, mass, position, rotation} = bodySpec;

      const convexHull = physics.RigidBody.make({
        type: physics.RigidBody.CONVEX_HULL,
        points,
        scale,
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
      const {points, scale, position, rotation} = bodySpec;

      const triangleMesh = physics.RigidBody.make({
        type: physics.RigidBody.CONVEX_HULL,
        points,
        scale,
        mass,
      });
      if (position) {
        triangleMesh.setPosition(position[0], position[1], position[2]);
      }
      if (rotation) {
        triangleMesh.setRotation(rotation[0], rotation[1], rotation[2], rotation[3]);
      }

      return triangleMesh;
    }
    default:
      return null;
  }
};

process.on('message', m => {
  const {type} = m;

  switch (type) {
    case 'requestUpdate':
      const {args: {id}} = m;
      _requestUpdate(id);
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
      const {args: {id}} = m;
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
    case 'setLinearVelocity': {
      const {args: {bodyId, linearVelocity}} = m;
      _setLinearVelocity({bodyId, linearVelocity});
      break;
    }
    case 'setAngularVelocity': {
      const {args: {bodyId, angularVelocity}} = m;
      _setAngularVelocity({bodyId, angularVelocity});
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
