const events = require('events');
const EventEmitter = events.EventEmitter;
const child_process = require('child_process');

const idUtils = require('./lib/idUtils');

class Antikyth extends EventEmitter {
  constructor() {
    super();

    const workerProcess = child_process.fork('./worker.js');
    workerProcess.on('message', m => {
      const {type} = m;

      if (type === 'update') {
        const {data: updates} = m;

        this.emit('update', updates);

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
    workerProcess.on('exit', code => {
      console.warn('worker exited with code', code);
    });

    this.workerProcess = workerProcess;
    this.updatesListeners = [];
    this.updateListeners = new Map();
  }

  start() {
    this.send('start');
  }

  stop() {
    this.send('stop');
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
  }

  removeWorld(world) {
    this.send('removeWorld', {
      id: world.id,
    });

    world.setParent(null);
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
        mass: body.mass,
      },
    });

    let prevUpdate = null;
    const _isUpdateEqual = (a, b) => {
      const {position: [pax, pay, paz], rotation: [rax, ray, raz, raw]} = a;
      const {position: [pbx, pby, pbz], rotation: [rbx, rby, rbz, rbw]} = b;

      return pax === pbx && pay === pby && paz === pbz &&
        rax === rbx && ray === rby && raz === rbz && raw === rbw;
    };
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

    this.updateListeners.delete(id);
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

  requestUpdate() {
    this.send('requestUpdate');
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

class World {
  constructor() {
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
        }
      }
      this.queue = [];
    }
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
        }
      }
      this.queue = [];
    }
  }
}

class Plane extends Body {
  constructor(opts) {
    super();

    const {position = null, rotation = null, dimensions = null, mass = 0} = opts;
    this.type = 'plane';
    this.position = position;
    this.rotation = rotation;
    this.dimensions = dimensions;
    this.mass = mass;
  }
}
Antikyth.Plane = Plane;

class Box extends Body {
  constructor(opts) {
    super();

    const {position = null, rotation = null, dimensions = null, mass = 0} = opts;
    this.type = 'box';
    this.position = position;
    this.rotation = rotation;
    this.dimensions = dimensions;
    this.mass = mass;
  }
}
Antikyth.Box = Box;

class Sphere extends Body {
  constructor(opts) {
    super();

    const {position = null, rotation = null, size = null, mass = 0} = opts;
    this.type = 'sphere';
    this.position = position;
    this.rotation = rotation;
    this.size = size;
    this.mass = mass;
  }
}
Antikyth.Sphere = Sphere;

class ConvexHull extends Body {
  constructor(opts) {
    super();

    const {position = null, rotation = null, points = null, mass = 0} = opts;
    this.type = 'convexHull';
    this.position = position;
    this.rotation = rotation;
    this.points = points;
    this.mass = mass;
  }
}
Antikyth.ConvexHull = ConvexHull;

class TriangleMesh extends Body {
  constructor(opts) {
    super();

    const {position = null, rotation = null, points = null, mass = 0} = opts;
    this.type = 'triangleMesh';
    this.position = position;
    this.rotation = rotation;
    this.points = points;
    this.mass = mass;
  }
}
Antikyth.TriangleMesh = TriangleMesh;

module.exports = Antikyth;
