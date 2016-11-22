const Antikyth = require('antikyth');

const OPEN = 1; // ws.OPEN

class Context {
  constructor(name) {
    this._name = name;

    this.objects = new Map();
  }

  create(type, id, opts) {
    const object = (() => {
      switch (type) {
        case 'engine': {
          const engine = new Antikyth(opts);
          engine.clientId = id;
          engine.start();
          return engine;
        }
        case 'world': {
          const world = new Antikyth.World(opts);
          world.clientId = id;
          return world;
        }
        case 'plane': {
          const plane = new Antikyth.Plane(opts);
          plane.clientId = id;
          return plane;
        }
        case 'box': {
          const box = new Antikyth.Box(opts);
          box.clientId = id;
          return box;
        }
        case 'sphere': {
          const sphere = new Antikyth.Sphere(opts);
          sphere.clientId = id;
          return sphere;
        }
        default: return null;
      }
    })();

    if (object) {
      const {clientId} = object;
      this.objects.set(clientId, object);
    }
  }

  destroy(id) {
    const {objects} = this;

    const object = objects.get(id);
    if (object instanceof Antikyth) {
      object.stop();
      object.destroy();
    }

    objects.delete(id);
  }

  add(parentId, childId) {
    const {objects} = this;

    const parent = objects.get(parentId);
    const child = objects.get(childId);
    parent.add(child);
  }

  remove(parentId, childId) {
    const {objects} = this;

    const parent = objects.get(parentId);
    const child = objects.get(childId);
    parent.remove(child);
  }

  setPosition(id, position) {
    const {objects} = this;

    const object = objects.get(id);
    object.setPosition(position);
  }

  setRotation(id, rotation) {
    const {objects} = this;

    const object = objects.get(id);
    object.setRotation(rotation);
  }

  setLinearVelocity(id, linearVelocity) {
    const {objects} = this;

    const object = objects.get(id);
    object.setLinearVelocity(linearVelocity);
  }

  setAngularVelocity(id, angularVelocity) {
    const {objects} = this;

    const object = objects.get(id);
    object.setAngularVelocity(angularVelocity);
  }

  requestUpdate(id, cb) {
    const {objects} = this;

    const object = objects.get(id);
    object.requestUpdate();
    object.once('update', updates => {
      cb(null, updates);
    });
  }
}

const server = ({wss}) => ({
  mount() {
    const contexts = new Map();

    const connections = [];

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      const match = url.match(/\/archae\/antikythWs\/(.*)/);
      if (match) {
        const contextName = match[1];

        let context = contexts.get(contextName);
        if (!context) {
          context = new Context();
          contexts.set(contextName, context);
        }

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
              const [id, position] = args;
              context.setPosition(id, position);

              cb();
            } else if (method === 'setRotation') {
              const [id, rotation] = args;
              context.setRotation(id, rotation);

              cb();
            } else if (method === 'setLinearVelocity') {
              const [id, linearVelocity] = args;
              context.setLinearVelocity(id, linearVelocity);

              cb();
            } else if (method === 'setAngularVelocity') {
              const [id, angularVelocity] = args;
              context.setAngularVelocity(id, angularVelocity);

              cb();
            } else if (method === 'requestUpdate') {
              const [id] = args;

              context.requestUpdate(id, updates => {
                if (live) {
                  cb(null, updates);
                }
              });

              cb();
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
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = server;
