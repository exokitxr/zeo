const path = require('path');
const events = require('events');
const EventEmitter = events.EventEmitter;
const child_process = require('child_process');

const idUtils = require('./lib/idUtils');

class Antikyth extends EventEmitter {
  constructor() {
    super();

    const workerProcess = child_process.fork(path.join(__dirname, 'worker.js'));
    workerProcess.on('message', m => {
      const {type} = m;

      if (type === 'update') {
        const {data: {id, updates}} = m;

        const listener = this.updateListeners.get(id);
        if (listener) {
          listener(updates);
        }

        for (let i = 0; i < updates.length; i++) {
          const update = updates[i];
          const {id} = update;
          const listener = this.updateListeners.get(id);
          if (listener) {
            const {position, rotation, linearVelocity, angularVelocity} = update;
            listener({position, rotation, linearVelocity, angularVelocity});
          }
        }
      } else {
        console.warn('unknown message type:', JSON.stringify(type));
      }
    });
    workerProcess.on('error', err => {
      console.warn(err);
    });
    workerProcess.on('exit', (code, signal) => {
      console.warn('worker exited with code/signal', code, signal);
    });

    this.workerProcess = workerProcess;
    this.running = false;
    this.updateListeners = new Map();
  }

  start() {
    this.send('start');

    this.running = true;
  }

  stop() {
    this.send('stop');

    this.running = false;
  }

  add(world) {
    this.addWorld(world);
  }

  remove(world) {
    this.removeWorld(world);
  }

  addWorld(world) {
    this.send('addWorld', {
      id: world.id,
    });

    world.setParent(this);

    let prevUpdate = [];
    this.updateListeners.set(world.id, nextUpdate => {
      const updateDiff = _getUpdateDiff(prevUpdate, nextUpdate);
      world.emit('update', updateDiff);

      prevUpdate = nextUpdate;
    });
  }

  removeWorld(world) {
    this.send('removeWorld', {
      id: world.id,
    });

    world.setParent(null);

    this.updateListeners.delete(world.id);
  }

  addBody(world, body) {
    const _formatPoints = points => {
      if (points) {
        if (Array.isArray(points)) {
          return points;
        } else {
          return Array.from(points);
        }
      } else {
        return null;
      }
    };

    this.send('addBody', {
      worldId: world.id,
      body: {
        id: body.id,
        type: body.type,
        position: body.position,
        dimensions: body.dimensions,
        size: body.size,
        points: _formatPoints(body.points),
        scale: body.scale,
        mass: body.mass,
      },
    });

    let prevUpdate = null;
    this.updateListeners.set(body.id, nextUpdate => {
      if (!prevUpdate || !_isUpdateEqual(nextUpdate, prevUpdate)) {
        body.emit('update', nextUpdate);

        prevUpdate = nextUpdate;
      }
    });
  }

  removeBody(world, body) {
    this.send('removeBody', {
      worldId: world.id,
      bodyId: body.id,
    });

    this.updateListeners.delete(body.id);
  }

  setWorldBodyPosition(world, body, x, y, z) {
    this.send('setPosition', {
      bodyId: body.id,
      position: [x, y, z],
    });
  }

  setWorldBodyRotation(world, body, x, y, z, w) {
    this.send('setRotation', {
      bodyId: body.id,
      rotation: [x, y, z, w],
    });
  }

  setWorldBodyLinearVelocity(world, body, x, y, z) {
    this.send('setLinearVelocity', {
      bodyId: body.id,
      linearVelocity: [x, y, z],
    });
  }

  setWorldBodyAngularVelocity(world, body, x, y, z) {
    this.send('setAngularVelocity', {
      bodyId: body.id,
      angularVelocity: [x, y, z],
    });
  }

  requestWorldUpdate(world) {
    this.send('requestUpdate', {
      id: world.id,
    });
  }

  send(type, args = {}) {
    this.workerProcess.send({
      type,
      args,
    });
  }

  destroy() {
    this.workerProcess.kill();
  }
}

class World extends EventEmitter {
  constructor() {
    super();

    this.id = idUtils.makeId();
    this.parent = null;
    this.queue = [];
  }

  add(body) {
    if (this.parent) {
      this.parent.addBody(this, body);
    } else {
      this.queue.push({
        method: 'add',
        args: body,
      });
    }

    body.setParent(this);
  }

  remove(body) {
    if (this.parent) {
      this.parent.removeBody(this, body);
    } else {
      this.queue.push({
        method: 'remove',
        args: body,
      });
    }

    body.setParent(null);
  }

  setBodyPosition(body, x, y, z) {
    if (this.parent) {
      this.parent.setWorldBodyPosition(this, body, x, y, z);
    } else {
      this.queue.push({
        method: 'setBodyPosition',
        args: {
          body,
          position: [x, y, z],
        }
      });
    }
  }

  setBodyRotation(body, x, y, z, w) {
    if (this.parent) {
      this.parent.setWorldBodyRotation(this, body, x, y, z, w);
    } else {
      this.queue.push({
        method: 'setBodyRotation',
        args: {
          body,
          rotation: [x, y, z, w],
        }
      });
    }
  }

  setBodyLinearVelocity(body, x, y, z) {
    if (this.parent) {
      this.parent.setWorldBodyLinearVelocity(this, body, x, y, z);
    } else {
      this.queue.push({
        method: 'setBodyLinearVelocity',
        args: {
          body,
          linearVelocity: [x, y, z],
        }
      });
    }
  }

  setBodyAngularVelocity(body, x, y, z) {
    if (this.parent) {
      this.parent.setWorldBodyAngularVelocity(this, body, x, y, z);
    } else {
      this.queue.push({
        method: 'setBodyAngularVelocity',
        args: {
          body,
          angularVelocity: [x, y, z],
        }
      });
    }
  }

  setParent(parent) {
    this.parent = parent;

    if (parent && this.queue.length > 0) {
      for (let i = 0; i < this.queue.length; i++) {
        const entry = this.queue[i];
        const {method, args} = entry;

        switch (method) {
          case 'add': {
            const body = args;
            this.parent.addBody(this, body);
            break;
          }
          case 'remove': {
            const body = args;
            this.parent.removeBody(this, body);
            break;
          }
          case 'setBodyPosition': {
            const {body, position: [x, y, z]} = args;
            this.parent.setWorldBodyPosition(this, body, x, y, z);
            break;
          }
          case 'setBodyRotation': {
            const {body, rotation: [x, y, z, w]} = args;
            this.parent.setWorldBodyRotation(this, body, x, y, z, w);
            break;
          }
          case 'setBodyLinearVelocity': {
            const {body, linearVelocity: [x, y, z]} = args;
            this.parent.setWorldBodyLinearVelocity(this, body, x, y, z);
            break;
          }
          case 'setBodyAngularVelocity': {
            const {body, linearVelocity: [x, y, z]} = args;
            this.parent.setWorldBodyAngularVelocity(this, body, x, y, z);
            break;
          }
        }
      }
      this.queue = [];
    }
  }

  requestUpdate() {
    this.parent.requestWorldUpdate(this);
  }
}
Antikyth.World = World;

class Body extends EventEmitter {
  constructor() {
    super();

    this.id = idUtils.makeId();
    this.parent = null;
    this.queue = [];
  }

  setPosition(x, y, z) {
    if (this.parent) {
      this.parent.setBodyPosition(this, x, y, z);
    } else {
      this.queue.push({
        method: 'setPosition',
        args: [x, y, z],
      });
    }
  }

  setRotation(x, y, z, w) {
    if (this.parent) {
      this.parent.setBodyRotation(this, x, y, z, w);
    } else {
      this.queue.push({
        method: 'setRotation',
        args: [x, y, z, w],
      });
    }
  }

  setLinearVelocity(x, y, z) {
    if (this.parent) {
      this.parent.setBodyLinearVelocity(this, x, y, z);
    } else {
      this.queue.push({
        method: 'setLinearVelocity',
        args: [x, y, z],
      });
    }
  }

  setAngularVelocity(x, y, z) {
    if (this.parent) {
      this.parent.setBodyAngularVelocity(this, x, y, z);
    } else {
      this.queue.push({
        method: 'setAngularVelocity',
        args: [x, y, z],
      });
    }
  }

  setParent(parent) {
    this.parent = parent;

    if (parent && this.queue.length > 0) {
      for (let i = 0; i < this.queue.length; i++) {
        const entry = this.queue[i];
        const {method, args} = entry;

        switch (method) {
          case 'setPosition': {
            const [x, y, z] = args;
            this.parent.setBodyPosition(this, x, y, z);
            break;
          }
          case 'setRotation': {
            const [x, y, z, w] = args;
            this.parent.setBodyRotation(this, x, y, z, w);
            break;
          }
          case 'setLinearVelocity': {
            const [x, y, z] = args;
            this.parent.setBodyLinearVelocity(this, x, y, z);
            break;
          }
          case 'setAngularVelocity': {
            const [x, y, z] = args;
            this.parent.setBodyAngularVelocity(this, x, y, z);
            break;
          }
        }
      }
      this.queue = [];
    }
  }
}
Antikyth.Body = Body;

class Plane extends Body {
  constructor(opts) {
    super();

    const {position = null, rotation = null, dimensions = null, scale = [1, 1, 1], mass = 0} = opts;
    this.type = 'plane';
    this.position = position;
    this.rotation = rotation;
    this.dimensions = dimensions;
    this.scale = scale;
    this.mass = mass;
  }
}
Antikyth.Plane = Plane;

class Box extends Body {
  constructor(opts) {
    super();

    const {position = null, rotation = null, dimensions = null, scale = [1, 1, 1], mass = 1} = opts;
    this.type = 'box';
    this.position = position;
    this.rotation = rotation;
    this.dimensions = dimensions;
    this.scale = scale;
    this.mass = mass;
  }
}
Antikyth.Box = Box;

class Sphere extends Body {
  constructor(opts) {
    super();

    const {position = null, rotation = null, size = null, scale = [1, 1, 1], mass = 1} = opts;
    this.type = 'sphere';
    this.position = position;
    this.rotation = rotation;
    this.size = size;
    this.scale = scale;
    this.mass = mass;
  }
}
Antikyth.Sphere = Sphere;

class ConvexHull extends Body {
  constructor(opts) {
    super();

    const {position = null, rotation = null, points = null, scale = [1, 1, 1], mass = 1} = opts;
    this.type = 'convexHull';
    this.position = position;
    this.rotation = rotation;
    this.points = points;
    this.scale = scale;
    this.mass = mass;
  }
}
Antikyth.ConvexHull = ConvexHull;

class TriangleMesh extends Body {
  constructor(opts) {
    super();

    const {position = null, rotation = null, points = null, scale = [1, 1, 1], mass = 0} = opts;
    this.type = 'triangleMesh';
    this.position = position;
    this.rotation = rotation;
    this.points = points;
    this.scale = scale;
    this.mass = mass;
  }
}
Antikyth.TriangleMesh = TriangleMesh;

const _isUpdateEqual = (a, b) => {
  const {position: [pax, pay, paz], rotation: [rax, ray, raz, raw]} = a;
  const {position: [pbx, pby, pbz], rotation: [rbx, rby, rbz, rbw]} = b;

  return pax === pbx && pay === pby && paz === pbz &&
    rax === rbx && ray === rby && raz === rbz && raw === rbw;
};
const _makeIdMap = a => {
  const result = {};

  for (let i = 0; i < a.length; i++) {
    const e = a[i];
    const {id} = e;
    result[id] = e;
  }

  return result;
};
const _getUpdateDiff = (prevUpdates, nextUpdates) => {
  const prevUpdatesIdMap = _makeIdMap(prevUpdates);

  return nextUpdates.filter(nextUpdate => {
    const prevUpdate = prevUpdatesIdMap[nextUpdate.id];
    return !prevUpdate || !_isUpdateEqual(prevUpdate, nextUpdate);
  });
};

module.exports = Antikyth;
