const Bullet = require('bullet');

const OPEN = 1; // ws.OPEN
const engineKey = null;

class Context {
  constructor() {
    this.objects = new Map(); // clientId -> Object
    this.updateIndex = new Map(); // engineId -> clientId
    this.childIndex = new Map(); // parentId -> [childId]

    const engine = new Bullet();
    this.setEngine(engine);
  }

  getEngine() {
    return this.objects.get(engineKey);
  }

  setEngine(engine) {
    this.objects.set(engineKey, engine);
  }

  hasRunnableObjects() {
    const {objects} = this;

    const _hasInstanceOf = type => {
      for (const [k, v] of objects) {
        if (v instanceof type) {
          return true;
        }
      }
      return false;
    };

    return _hasInstanceOf(Bullet.World) && _hasInstanceOf(Bullet.Body);
  }

  create(type, id, opts) {
    const object = (() => {
      switch (type) {
        case 'world': return new Bullet.World(opts);
        case 'plane': return new Bullet.Plane(opts);
        case 'box': return new Bullet.Box(opts);
        case 'sphere': return new Bullet.Sphere(opts);
        case 'convexHull': return new Bullet.ConvexHull(opts);
        case 'triangleMesh': return new Bullet.TriangleMesh(opts);
        case 'compound': return new Bullet.Compound(opts);
        case 'constraint': {
          const {bodyAId, bodyBId, pivotA, pivotB} = opts;
          const bodyA = this.objects.get(bodyAId);
          const bodyB = this.objects.get(bodyBId);

          return new Bullet.Constraint({
            bodyA,
            bodyB,
            pivotA,
            pivotB,
          });
        }
        default: return null;
      }
    })();

    this.objects.set(id, object);
    this.updateIndex.set(object.id, id);

    const engine = this.getEngine();
    if (!engine.running && this.hasRunnableObjects()) {
      engine.start();
    }
  }

  destroy(id) {
    const object = this.objects.get(id);
    if (object) {
      this.objects.delete(id);
      this.updateIndex.delete(object.id);
    }

    const childIds = this.childIndex.get(id);
    if (childIds) {
      for (let i = 0; i < childIds.length; i++) {
        const childId = childIds[i];
        this.destroy(childId);
      }
      this.childIndex.delete(id);
    }

    const engine = this.getEngine();
    if (engine.running && !this.hasRunnableObjects()) {
      engine.stop();
    }
  }

  add(parentId, childId) {
    const {objects} = this;

    const parent = objects.get(parentId);
    const child = objects.get(childId);
    parent.add(child);

    let childIds = this.childIndex.get(parentId);
    if (!childIds) {
      childIds = [];
      this.childIndex.set(parentId, childIds);
    }
    childIds.push(childId);
  }

  remove(parentId, childId) {
    const {objects} = this;

    const parent = objects.get(parentId);
    const child = objects.get(childId);
    if (parent && child) {
      parent.remove(child);

      const childIds = this.childIndex.get(parentId);
      childIds.splice(childIds.indexOf(childId), 1);
      if (childIds.length === 0) {
        this.childIndex.delete(parentId);
      }
    }
  }

  setPosition(id, position) {
    const {objects} = this;

    const object = objects.get(id);
    const [x, y, z] = position;
    object.setPosition(x, y, z);
  }

  setRotation(id, rotation) {
    const {objects} = this;

    const object = objects.get(id);
    const [x, y, z, w] = rotation;
    object.setRotation(x, y, z, w);
  }

  setLinearVelocity(id, linearVelocity) {
    const {objects} = this;

    const object = objects.get(id);
    const [x, y, z] = linearVelocity;
    object.setLinearVelocity(x, y, z);
  }

  setAngularVelocity(id, angularVelocity) {
    const {objects} = this;

    const object = objects.get(id);
    const [x, y, z] = angularVelocity;
    object.setAngularVelocity(x, y, z);
  }

  setLinearFactor(id, linearFactor) {
    const {objects} = this;

    const object = objects.get(id);
    const [x, y, z] = linearFactor;
    object.setLinearFactor(x, y, z);
  }

  setAngularFactor(id, angularFactor) {
    const {objects} = this;

    const object = objects.get(id);
    const [x, y, z] = angularFactor;
    object.setAngularFactor(x, y, z);
  }

  activate(id) {
    const {objects} = this;

    const object = objects.get(id);
    object.activate();
  }

  deactivate(id) {
    const {objects} = this;

    const object = objects.get(id);
    object.deactivate();
  }

  setIgnoreCollisionCheck(sourceBodyId, targetBodyId, ignore) {
    const {objects} = this;

    const sourceBody = objects.get(sourceBodyId);
    const targetBody = objects.get(targetBodyId);
    sourceBody.setIgnoreCollisionCheck(targetBody, ignore);
  }

  requestUpdate(id, cb) {
    const {objects} = this;

    const object = objects.get(id);
    if (object) {
      object.requestUpdate();
      object.once('update', engineUpdates => {
        const clientUpdates = engineUpdates.map(update => {
          const {id: engineId, position, rotation, linearVelocity, angularVelocity} = update;
          const clientId = this.updateIndex.get(engineId);

          return {
            id: clientId,
            position,
            rotation,
            linearVelocity,
            angularVelocity,
          };
        });

        cb(null, clientUpdates);
      });
    } else {
      cb(null, []);
    }
  }
}

class BulletServer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {wss} = archae.getCore();

    const context = new Context();

    const connections = [];

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      if (url === '/archae/bulletWs') {
        c.on('message', s => {
          const m = JSON.parse(s);
          if (typeof m === 'object' && m && typeof m.method === 'string' && typeof m.id === 'string' && Array.isArray(m.args)) {
            const {method, id, args} = m;

            const cb = (err = null, result = null) => {
              if (c.readyState === OPEN) {
                const e = {
                  id: id,
                  error: err,
                  result: result,
                };
                const es = JSON.stringify(e);
                c.send(es);
              }
            };

            if (method === 'create') {
              const [type, id, opts] = args;
              context.create(type, id, opts);

              cb();
            } else if (method === 'destroy') {
              const [id] = args;
              context.destroy(id);

              cb();
            } else if (method === 'add') {
              const [parentId, childId] = args;
              context.add(parentId, childId);

              cb();
            } else if (method === 'remove') {
              const [parentId, childId] = args;
              context.remove(parentId, childId);

              cb();
            } else if (method === 'setPosition') {
              const [id, position, activate] = args;
              context.setPosition(id, position, activate);

              cb();
            } else if (method === 'setRotation') {
              const [id, rotation, activate] = args;
              context.setRotation(id, rotation, activate);

              cb();
            } else if (method === 'setLinearVelocity') {
              const [id, linearVelocity, activate] = args;
              context.setLinearVelocity(id, linearVelocity, activate);

              cb();
            } else if (method === 'setAngularVelocity') {
              const [id, angularVelocity, activate] = args;
              context.setAngularVelocity(id, angularVelocity, activate);

              cb();
            } else if (method === 'setLinearFactor') {
              const [id, linearFactor, activate] = args;
              context.setLinearFactor(id, linearFactor, activate);

              cb();
            } else if (method === 'setAngularFactor') {
              const [id, angularFactor, activate] = args;
              context.setAngularFactor(id, angularFactor, activate);

              cb();
            } else if (method === 'activate') {
              const [id] = args;
              context.activate(id);

              cb();
            } else if (method === 'deactivate') {
              const [id] = args;
              context.deactivate(id);

              cb();
            } else if (method === 'setIgnoreCollisionCheck') {
              const [sourceId, targetId, ignore] = args;
              context.setIgnoreCollisionCheck(sourceId, targetId, ignore);

              cb();
            } else if (method === 'requestUpdate') {
              const [id] = args;
              context.requestUpdate(id, (err, updates) => {
                if (live) {
                  cb(err, updates);
                }
              });
            } else {
              const err = new Error('no such method:' + JSON.stringify(method));
              cb(err.stack);
            }
          }
        });
        c.on('close', () => {
          connections.splice(connections.indexOf(c), 1);
        });

        connections.push(c);
      }
    });

    let live = true;
    this._cleanup = () => {
      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.close();
      }
      connections = [];

      live = false;
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = BulletServer;
