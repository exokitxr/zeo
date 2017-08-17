const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,
} = require('./lib/constants/constants');

class Lightmap {
  mount() {
    const {three, elements, render, utils: {js: jsUtils}} = zeo;
    const {THREE} = three;
    const {events, mod, bffr} = jsUtils;
    const {EventEmitter} = events;

    const _getLightmapIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

    let idCount = 0;
    class Ambient {
      constructor(v, blend = Lightmapper.AddBlend) {
        this.type = 'ambient';

        this.id = idCount++;
        this.v = v;
        this.blend = blend;
      }

      getLightmapsInRange(width, depth, lightmaps) {
        return lightmaps;
      }
    }
    class Sphere {
      constructor(x, y, z, r, v, blend = Lightmapper.AddBlend) {
        this.type = 'sphere';

        this.id = idCount++;
        this.x = Math.floor(x);
        this.y = Math.floor(y);
        this.z = Math.floor(z);
        this.r = Math.floor(r);
        this.v = v;
        this.blend = blend;
      }

      getLightmapsInRange(width, depth, lightmaps) {
        const {x, z, r} = this;

        const result = [];
        const _tryPoint = (ox, oz) => {
          const lightmap = lightmaps[_getLightmapIndex(ox, oz)];
          if (lightmap) {
            result.push(lightmap);
          }
        };
        _tryPoint(Math.floor((x - r) / width), Math.floor((z - r) / depth));
        _tryPoint(Math.floor((x + r) / width), Math.floor((z - r) / depth));
        _tryPoint(Math.floor((x - r) / width), Math.floor((z + r) / depth));
        _tryPoint(Math.floor((x + r) / width), Math.floor((z + r) / depth));
        return result;
      }
    }
    class Cylinder {
      constructor(x, y, z, h, r, v, blend = Lightmapper.AddBlend) {
        this.type = 'cylinder';

        this.id = idCount++;
        this.x = Math.floor(x);
        this.y = Math.floor(y);
        this.z = Math.floor(z);
        this.h = Math.floor(h);
        this.r = Math.floor(r);
        this.v = v;
        this.blend = blend;
      }

      getLightmapsInRange(width, depth, lightmaps) {
        const {x, z, r} = this;

        const result = [];
        const _tryPoint = (ox, oz) => {
          const lightmap = lightmaps[_getLightmapIndex(ox, oz)];
          if (lightmap) {
            result.push(lightmap);
          }
        };
        _tryPoint(Math.floor((x - r) / width), Math.floor((z - r) / depth));
        _tryPoint(Math.floor((x + r) / width), Math.floor((z - r) / depth));
        _tryPoint(Math.floor((x - r) / width), Math.floor((z + r) / depth));
        _tryPoint(Math.floor((x + r) / width), Math.floor((z + r) / depth));
        return result;
      }
    }
    class Voxel {
      constructor(x, y, z, v, blend = Lightmapper.AddBlend) {
        this.type = 'voxel';

        this.id = idCount++;
        this.x = Math.floor(x);
        this.y = Math.floor(y);
        this.z = Math.floor(z);
        this.v = v;
        this.blend = blend;
      }

      getLightmapsInRange(width, depth, lightmaps) {
        const {x, z} = this;
        const ox = Math.floor(x / width);
        const oz = Math.floor(z / depth);

        const lightmap = lightmaps.find(lightmap => lightmap.x === ox && lightmap.z === oz);
        if (lightmap) {
          return [lightmap];
        } else {
          return [];
        }
      }
    }

    class Lightmap extends EventEmitter {
      constructor(x, z, width, height, depth, buffers) {
        super();

        this.x = x;
        this.z = z;
        this.index = _getLightmapIndex(x, z);
        this.buffers = buffers;

        const buffer = buffers.alloc();
        this.buffer = buffer;
        const texture = new THREE.DataTexture(
          new Uint8Array(buffer.byteLength),
          (width + 1) * (depth + 1),
          height,
          THREE.LuminanceFormat,
          THREE.UnsignedByteType,
          THREE.UVMapping,
          THREE.ClampToEdgeWrapping,
          THREE.ClampToEdgeWrapping,
          THREE.NearestFilter,
          THREE.NearestFilter,
          1
        );
        this.texture = texture;
        this.refCount = 0;
      }

      addRef() {
        this.refCount++;
      }

      removeRef() {
        if (--this.refCount === 0) {
          this.destroy();
        }
      }

      destroy() {
        this.texture.dispose();

        this.buffers.free(this.buffer);

        this.emit('destroy');
      }
    }

    class Lightmapper {
      constructor({width = NUM_CELLS + 1, height = NUM_CELLS_HEIGHT, depth = NUM_CELLS + 1} = {}) {
        this.width = width;
        this.height = height;
        this.depth = depth;

        const worker = new Worker('archae/plugins/_plugins_lightmap/build/worker.js');
        const queue = [];
        worker.init = (width, height, depth) => {
          worker.postMessage({
            type: 'init',
            width,
            height,
            depth,
          });
        };
        worker.addShape = spec => {
          worker.postMessage({
            type: 'addShape',
            spec: spec,
          });
        };
        worker.removeShape = id => {
          worker.postMessage({
            type: 'removeShape',
            id: id,
          });
        };
        worker.removeShapes = ids => {
          worker.postMessage({
            type: 'removeShapes',
            ids: ids,
          });
        };
        worker.requestUpdate = lightmap => new Promise((accept, reject) => {
          const {x: ox, z: oz, buffer} = lightmap;
          worker.postMessage({
            type: 'requestUpdate',
            ox,
            oz,
            buffer,
          }, [buffer]);

          queue.push(buffer => {
            lightmap.buffer = buffer;
            lightmap.texture.image.data.set(new Uint8Array(buffer));
            lightmap.texture.needsUpdate = true;

            accept();
          });
        });
        worker.onmessage = e => {
          const {data: {buffer}} = e;
          queue.shift()(buffer);
        };
        worker.init(width, height, depth);
        this.worker = worker;

        this._lightmaps = {};
        this._lightmapsNeedUpdate = {};
        this._buffers = bffr((width + 1) * (depth + 1) * height, 3 * 3 * 12);

        this.debouncedUpdate = _debounce(next => {
          this.update()
            .then(next)
            .catch(err => {
              console.warn(err);
              next();
            });
        });
      }

      getLightmapAt(x, z) {
        const {width, height, depth, _lightmaps: lightmaps, _lightmapsNeedUpdate: lightmapsNeedUpdate, _buffers: buffers} = this;
        const ox = Math.floor(x / width);
        const oz = Math.floor(z / depth);

        const index = _getLightmapIndex(ox, oz);
        let entry = lightmaps[index];
        if (!entry) {
          entry = new Lightmap(ox, oz, width, height, depth, buffers);
          entry.on('destroy', () => {
            lightmaps[index] = null;
            lightmapsNeedUpdate[index] = false;
            // XXX gc after too many destroys
          });
          lightmaps[index] = entry;
          lightmapsNeedUpdate[index] = true;
        }
        entry.addRef();
        return entry;
      }

      releaseLightmap(lightmap) {
        lightmap.removeRef();
      }

      add(shape) {
        this.worker.addShape(shape);

        const {width, depth, _lightmaps: lightmaps, _lightmapsNeedUpdate: lightmapsNeedUpdate} = this;
        const newLightmapsNeedUpdate = shape.getLightmapsInRange(width, depth, lightmaps);
        for (let i = 0; i < newLightmapsNeedUpdate.length; i++) {
          lightmapsNeedUpdate[newLightmapsNeedUpdate[i].index] = true;
        }

        this.debouncedUpdate();
      }

      remove(shape) {
        const {id} = shape;
        this.worker.removeShape(id);

        const {width, depth, _lightmaps: lightmaps, _lightmapsNeedUpdate: lightmapsNeedUpdate} = this;
        const newLightmapsNeedUpdate = shape.getLightmapsInRange(width, depth, lightmaps);
        for (let i = 0; i < newLightmapsNeedUpdate.length; i++) {
          lightmapsNeedUpdate[newLightmapsNeedUpdate[i].index] = true;
        }

        this.debouncedUpdate();
      }

      update() {
        const promises = [];
        for (const index in this._lightmapsNeedUpdate) {
          if (this._lightmapsNeedUpdate[index]) {
            const lightmap = this._lightmaps[index];
            if (lightmap) {
              promises.push(this.worker.requestUpdate(lightmap));
            }
          }
        }
        this._lightmapsNeedUpdate = {};
        return Promise.all(promises);
      }
    };
    Lightmapper.Ambient = Ambient;
    Lightmapper.Sphere = Sphere;
    Lightmapper.Cylinder = Cylinder;
    Lightmapper.Voxel = Voxel;
    Lightmapper.AddBlend = 'add';
    Lightmapper.SubBlend = 'sub';
    Lightmapper.MaxBlend = 'max';

    const lightmapEntity = {
      entityAddedCallback(entityElement) {
        entityElement.Lightmapper = Lightmapper;

        const lightmapper = new Lightmapper({
          width: NUM_CELLS,
          height: NUM_CELLS_HEIGHT,
          depth: NUM_CELLS,
        });
        lightmapper.add(new Lightmapper.Ambient(255 * 0.5));
        lightmapper.add(new Lightmapper.Sphere(0, 64 + 32, 0, 8, 2, Lightmapper.MaxBlend));
        entityElement.lightmapper = lightmapper;

        let recurseTimeout = null;
        const _recurse = () => {
          lightmapper.debouncedUpdate();
          recurseTimeout = setTimeout(_recurse, 1000);
        };
        _recurse();

        entityElement._cleanup = () => {
          clearTimeout(recurseTimeout);
        };
      },
      entityRemovedCallback(entityElement) {
        entityElement._cleanup();
      },
    };
    elements.registerEntity(this, lightmapEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, lightmapEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}
const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = Lightmap;
