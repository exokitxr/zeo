const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  RANGE,
} = require('./lib/constants/constants');

class Lightmap {
  mount() {
    const {three, pose, elements, render, utils: {js: {events, mod, bffr}, random: {chnkr}}} = zeo;
    const {THREE} = three;
    const {EventEmitter} = events;

    const _getLightmapIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);
    const _chunkRangeContains = (a, b) => b[0] >= a[0] && b[2] <= a[2] && b[1] >= a[1] && b[3] <= a[3];

    let idCount = 0;
    class Ambient {
      constructor(v, blend = Lightmapper.AddBlend) {
        this.type = 'ambient';

        this.id = idCount++;
        this.v = v;
        this.blend = blend;
      }

      set(spec, transfers) {
        if (spec.v !== undefined) {
          this.v = spec.v;
        }
        this._parent._setShapeData(this, spec, transfers);
      }

      getChunkRange() {
        return [
          -Infinity,
          -Infinity,
          Infinity,
          Infinity,
        ];
      }
    }
    class Heightfield {
      constructor(x, z, data, blend = Lightmapper.AddBlend) {
        this.type = 'heightfield';

        this.id = idCount++;
        this.x = Math.floor(x);
        this.z = Math.floor(z);
        this.data = data;
        this.blend = blend;

        this._parent = null;
      }

      set(spec, transfers) {
        if (spec.x !== undefined) {
          this.x = spec.x;
        }
        if (spec.z !== undefined) {
          this.z = spec.z;
        }
        if (spec.data !== undefined) {
          this.data = spec.data;
        }
        this._parent._setShapeData(this, spec, transfers);
      }

      getChunkRange() {
        const {x, z} = this;
        const ox = Math.floor(x / NUM_CELLS);
        const oz = Math.floor(z / NUM_CELLS);
        return [
          ox,
          oz,
          ox + 1,
          oz + 1,
        ];
      }
    }
    class Ether {
      constructor(x, z, data, blend = Lightmapper.AddBlend) {
        this.type = 'ether';

        this.id = idCount++;
        this.x = Math.floor(x);
        this.z = Math.floor(z);
        this.data = data;
        this.blend = blend;

        this._parent = null;
      }

      set(spec, transfers) {
        if (spec.x !== undefined) {
          this.x = spec.x;
        }
        if (spec.z !== undefined) {
          this.z = spec.z;
        }
        if (spec.data !== undefined) {
          this.data = spec.data;
        }
        this._parent._setShapeData(this, spec, transfers);
      }

      getChunkRange() {
        const {x, z} = this;
        const ox = Math.floor(x / NUM_CELLS);
        const oz = Math.floor(z / NUM_CELLS);
        return [
          ox,
          oz,
          ox + 1,
          oz + 1,
        ];
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

        this._parent = null;
      }

      set(spec, transfers) {
        if (spec.x !== undefined) {
          this.x = spec.x;
        }
        if (spec.y !== undefined) {
          this.y = spec.y;
        }
        if (spec.z !== undefined) {
          this.z = spec.z;
        }
        if (spec.r !== undefined) {
          this.r = spec.r;
        }
        if (spec.v !== undefined) {
          this.v = spec.v;
        }
        this._parent._setShapeData(this, spec, transfers);
      }

      getChunkRange() {
        const {x, z, r} = this;
        return [
          Math.floor((x - r) / NUM_CELLS),
          Math.floor((z - r) / NUM_CELLS),
          Math.floor((x + r) / NUM_CELLS) + 1,
          Math.floor((z + r) / NUM_CELLS) + 1,
        ];
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

        this._parent = null;
      }

      set(spec, transfers) {
        if (spec.x !== undefined) {
          this.x = spec.x;
        }
        if (spec.y !== undefined) {
          this.y = spec.y;
        }
        if (spec.z !== undefined) {
          this.z = spec.z;
        }
        if (spec.h !== undefined) {
          this.h = spec.h;
        }
        if (spec.r !== undefined) {
          this.r = spec.r;
        }
        if (spec.v !== undefined) {
          this.v = spec.v;
        }
        this._parent._setShapeData(this, spec, transfers);
      }

      getChunkRange() {
        const {x, z, r} = this;
        return [
          Math.floor((x - r) / NUM_CELLS),
          Math.floor((z - r) / NUM_CELLS),
          Math.floor((x + r) / NUM_CELLS) + 1,
          Math.floor((z + r) / NUM_CELLS) + 1,
        ];
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

        this._parent = null;
      }

      set(spec, transfers) {
        if (spec.x !== undefined) {
          this.x = spec.x;
        }
        if (spec.y !== undefined) {
          this.y = spec.y;
        }
        if (spec.z !== undefined) {
          this.z = spec.z;
        }
        if (spec.v !== undefined) {
          this.v = spec.v;
        }
        this._parent._setShapeData(this, spec, transfers);
      }

      getChunkRange() {
        const {x, z, r} = this;
        const ox = Math.floor(x / NUM_CELLS);
        const oz = Math.floor(z / NUM_CELLS);
        return [
          ox,
          oz,
          ox + 1,
          oz + 1,
        ];
      }
    }

    class Lightmapper extends EventEmitter {
      constructor() {
        super();

        const worker = new Worker('archae/plugins/_plugins_lightmap/build/worker.js');
        const queue = [];
        worker.addShape = (spec, transfers) => {
          worker.postMessage({
            type: 'addShape',
            spec: spec,
          }, transfers);
        };
        worker.removeShape = id => {
          worker.postMessage({
            type: 'removeShape',
            id: id,
          });
        };
        worker.setShapeData = (id, spec, transfers) => {
          worker.postMessage({
            type: 'setShapeData',
            id: id,
            spec: spec,
          }, transfers);
        };
        worker.removeShapes = ids => {
          worker.postMessage({
            type: 'removeShapes',
            ids: ids,
          });
        };
        worker.requestRender = (lightmapBuffer, cb) => {
          worker.postMessage({
            type: 'render',
            lightmapBuffer,
          }, [lightmapBuffer.buffer]);

          queue.push(cb);
        };
        worker.requestUpdate = (ox, oz, buffer, cb) => {
          worker.postMessage({
            type: 'requestUpdate',
            ox,
            oz,
            buffer,
          }, [buffer]);

          queue.push(cb);
        };
        worker.onmessage = e => {
          const {data} = e;
          const {type} = data;

          if (type === 'response') {
            queue.shift()(data.result);
          } else if (type === 'releaseBuffer') {
            this.buffers.free(data.buffer);
          } else {
            console.warn('lightmap unknown worker message type:', JSON.stringify(type));
          }
        };
        this.worker = worker;

        this.buffers = bffr((NUM_CELLS + 1) * (NUM_CELLS + 1) * 4, (RANGE + 1) * (RANGE + 1) * 2);

        this.chunkRangesNeedUpdate = [];
      }

      add(shape, transfers, {update = true} = {}) {
        this.worker.addShape(shape, transfers);

        shape._parent = this;

        if (update) {
          this.addChunkRangeNeedsUpdate(shape.getChunkRange());

          setTimeout(() => {
            this.updateChunkRanges();
          });
        }
      }

      remove(shape, {update = true} = {}) {
        this.worker.removeShape(shape.id);

        if (update) {
          this.addChunkRangeNeedsUpdate(shape.getChunkRange());

          setTimeout(() => {
            this.updateChunkRanges();
          });
        }
      }

      _setShapeData(shape, spec, transfers) {
        this.worker.setShapeData(shape.id, spec, transfers);
      }

      addChunkRangeNeedsUpdate(chunkRange) {
        if (!this.chunkRangesNeedUpdate.some(localChunkRange => _chunkRangeContains(localChunkRange, chunkRange))) {
          this.chunkRangesNeedUpdate.push(chunkRange);
        }
      }

      updateChunkRanges() {
        for (let i = 0; i < this.chunkRangesNeedUpdate.length; i++) {
          this.emit('update', this.chunkRangesNeedUpdate[i]);
        }
        this.chunkRangesNeedUpdate.length = 0;
      }

      requestRender(lightmapBuffer, cb) {
        this.worker.requestRender(lightmapBuffer, cb);
      }
    };
    Lightmapper.Ambient = Ambient;
    Lightmapper.Heightfield = Heightfield;
    Lightmapper.Ether = Ether;
    Lightmapper.Sphere = Sphere;
    Lightmapper.Cylinder = Cylinder;
    Lightmapper.Voxel = Voxel;
    Lightmapper.AddBlend = 'add';
    Lightmapper.SubBlend = 'sub';
    Lightmapper.MaxBlend = 'max';

    const lightmapEntity = {
      entityAddedCallback(entityElement) {
        entityElement.Lightmapper = Lightmapper;

        const lightmapper = new Lightmapper();
        lightmapper.add(new Lightmapper.Sphere(0, 64 + 32, 0, 8, 2, Lightmapper.MaxBlend));
        entityElement.lightmapper = lightmapper;
      },
      entityRemovedCallback(entityElement) {
        // XXX
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
