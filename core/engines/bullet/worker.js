const physics = require('./build/Release/physics.node');

const FPS = 60;
const RESOLUTION = 4;
const STEP_SECONDS = 1 / FPS;
const STEP_MILLISECONDS = 1000 / FPS;

const worlds = new Map(); // worldId -> World
const bodies = new Map(); // bodyId -> Body
const worldBodyIndex = new Map(); // worldId -> [bodyId]
const bodyWorldIndex = new Map(); // bodyId -> worldId

const _requestUpdate = worldId => {
  const bodyIds = worldBodyIndex.get(worldId);
  const updates = bodyIds.map(bodyId => {
    const body = bodies.get(bodyId);

    const {objectType, type} = body;
    if (
      objectType === physics.RigidBody.OBJECT_TYPE && // only update bodies (as opposed to constraints)
      type !== 'plane' && type !== 'triangleMesh' // only update non-static bodies
    ) {
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
    } else {
      return null;
    }
  }).filter(update => update !== null);

  send('update', {
    id: worldId,
    updates,
  });
};
const _requestInit = worldId => {
  const bodyIds = worldBodyIndex.get(worldId);
  const objects = bodyIds.map(bodyId => {
    const body = bodies.get(bodyId);

    const {objectType} = body;
    if (objectType === physics.RigidBody.OBJECT_TYPE) { // only return bodies (as opposed to constraints)
      const {spec} = body;
      return spec;
    } else {
      return null;
    }
  }).filter(object => object !== null);

  send('init', {
    id: worldId,
    objects,
  });
};
let interval = null;
const _start = () => {
  _stop();

  let lastUpdate = Date.now();
  interval = setInterval(() => {
    const now = Date.now();
    const timeDiff = now - lastUpdate;

    worlds.forEach(world => {
      world.stepSimulation(timeDiff, RESOLUTION, STEP_SECONDS / RESOLUTION);
    });

    lastUpdate = now;
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
const _addConstraint = ({worldId, constraint: constraintSpec}) => {
  const constraint = _makeConstraint(constraintSpec);
  const {id: constraintId} = constraintSpec;
  bodies.set(constraintId, constraint);

  const world = worlds.get(worldId)
  world.addConstraint(constraint);

  const worldBodyIds = worldBodyIndex.get(worldId);
  worldBodyIds.push(constraintId);

  bodyWorldIndex.set(constraintId, worldId);
};
const _removeConstraint = ({constraintId}) => {
  const constraint = bodies.get(constraintId);

  const worldId = bodyWorldIndex.get(constraintId);
  const world = worlds.get(worldId);
  world.removeConstraint(constraint);

  bodies.delete(constraintId);
  const worldBodyIds = worldBodyIndex.get(worldId);
  worldBodyIds.splice(worldBodyIds.indexOf(constraintId), 1);
  bodyWorldIndex.delete(constraintId);
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
const _setLinearFactor = ({bodyId, linearFactor}) => {
  const body = bodies.get(bodyId);

  const [x, y, z] = linearFactor;
  body.setLinearFactor(x, y, z);
};
const _setAngularFactor = ({bodyId, angularFactor}) => {
  const body = bodies.get(bodyId);

  const [x, y, z] = angularFactor;
  body.setAngularFactor(x, y, z);
};
const _activateBody = ({id}) => {
  const body = bodies.get(id);
  body.activate();
};
const _deactivateBody = ({id}) => {
  const body = bodies.get(id);
  body.deactivate();
};
const _disableDeactivationBody = ({id}) => {
  const body = bodies.get(id);
  body.disableDeactivation();
};
const _setIgnoreCollisionCheck = ({sourceBodyId, targetBodyId, ignore}) => {
  const sourceBody = bodies.get(sourceBodyId);
  const targetBody = bodies.get(targetBodyId);
  sourceBody.setIgnoreCollisionCheck(targetBody, ignore);
};

const _makeBody = bodySpec => {
  const {type} = bodySpec;

  switch (type) {
    case 'plane': {
      const {dimensions, scale, mass, position, rotation} = bodySpec;

      const plane = physics.RigidBody.make({
        type: 'plane',
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
        type: 'box',
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
        type: 'sphere',
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
        type: 'convexHull',
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
      const {points, scale, mass, position, rotation} = bodySpec;

      const triangleMesh = physics.RigidBody.make({
        type: 'triangleMesh',
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
    case 'compound': {
      const {children, scale, mass, position, rotation} = bodySpec;

      const triangleMesh = physics.RigidBody.make({
        type: 'compound',
        children: children.map(child => {
          const {type, position, rotation} = child;

          switch (type) {
            case 'plane': {
              const {dimensions} = child;
              return {
                type: 'plane',
                dimensions,
                position,
                rotation,
              };
            }
            case 'box': {
              const {dimensions} = child;
              return {
                type: 'box',
                dimensions,
                position,
                rotation,
              };
            }
            case 'sphere': {
              const {size} = child;
              return {
                type: 'sphere',
                size,
                position,
                rotation,
              };
            }
            // XXX add remaining types here
            default:
              return null;
          }
        }),
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
const _makeConstraint = constraintSpec => {
  const {bodyAId, bodyBId, pivotA, pivotB} = constraintSpec;
  const bodyA = bodies.get(bodyAId);
  const bodyB = bodies.get(bodyBId);

  return physics.Constraint.make(bodyA, bodyB, pivotA, pivotB);
};

process.on('message', m => {
  const {type} = m;

  switch (type) {
    case 'requestUpdate': {
      const {args: {id}} = m;
      _requestUpdate(id);
      break;
    }
    case 'requestInit': {
      const {args: {id}} = m;
      _requestInit(id);
      break;
    }
    case 'start': {
      _start();
      break;
    }
    case 'stop': {
      _stop();
    }
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
    case 'addConstraint': {
      const {args: {worldId, constraint}} = m;
      _addConstraint({worldId, constraint});
      break;
    }
    case 'removeConstraint': {
      const {args: {constraintId}} = m;
      _removeConstraint({constraintId});
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
    case 'setLinearFactor': {
      const {args: {bodyId, linearFactor}} = m;
      _setLinearFactor({bodyId, linearFactor});
      break;
    }
    case 'setAngularFactor': {
      const {args: {bodyId, angularFactor}} = m;
      _setAngularFactor({bodyId, angularFactor});
      break;
    }
    case 'activateBody': {
      const {args: {id}} = m;
      _activateBody({id});
      break;
    }
    case 'deactivateBody': {
      const {args: {id}} = m;
      _deactivateBody({id});
      break;
    }
    case 'disableDeactivationBody': {
      const {args: {id}} = m;
      _disableDeactivationBody({id});
      break;
    }
    case 'setIgnoreCollisionCheck': {
      const {args: {sourceBodyId, targetBodyId, ignore}} = m;
      _setIgnoreCollisionCheck({sourceBodyId, targetBodyId, ignore});
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
