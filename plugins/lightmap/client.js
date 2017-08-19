const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  RANGE,
} = require('./lib/constants/constants');

class Lightmap {
  mount() {
    const {three, pose, elements, render, utils: {js: jsUtils, random: {chnkr}}} = zeo;
    const {THREE} = three;
    const {events, mod, bffr} = jsUtils;
    const {EventEmitter} = events;

    const _getLightmapIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);
    const zeroUint8Array = Uint8Array.from([0]);

    let idCount = 0;
    class Ambient {
      constructor(v, blend = Lightmapper.AddBlend) {
        this.type = 'ambient';

        this.id = idCount++;
        this.v = v;
        this.blend = blend;
      }

      set(spec) {
        if (spec.v !== undefined) {
          this.v = spec.v;
        }
        this._parent._setShapeData(this, spec);
      }

      getLightmapsInRange(width, depth, lightmaps) {
        return lightmaps;
      }
    }
    class Heightfield {
      constructor(x, z, v, data, blend = Lightmapper.AddBlend) {
        this.type = 'heightfield';

        this.id = idCount++;
        this.x = Math.floor(x);
        this.z = Math.floor(z);
        this.v = v;
        this.data = data;
        this.blend = blend;

        this._parent = null;
      }

      set(spec) {
        if (spec.x !== undefined) {
          this.x = spec.x;
        }
        if (spec.z !== undefined) {
          this.z = spec.z;
        }
        if (spec.v !== undefined) {
          this.v = spec.v;
        }
        if (spec.data !== undefined) {
          this.data = spec.data;
        }
        this._parent._setShapeData(this, spec);
      }

      getLightmapsInRange(width, depth, lightmaps) {
        const {x, z} = this;
        const ox = Math.floor(x / width);
        const oz = Math.floor(z / depth);

        const lightmap = lightmaps[_getLightmapIndex(ox, oz)];
        return lightmap ? [lightmap] : [];
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

      set(spec) {
        if (spec.x !== undefined) {
          this.x = spec.x;
        }
        if (spec.z !== undefined) {
          this.z = spec.z;
        }
        if (spec.data !== undefined) {
          this.data = spec.data;
        }
        this._parent._setShapeData(this, spec);
      }

      getLightmapsInRange(width, depth, lightmaps) {
        const {x, z} = this;
        const ox = Math.floor(x / width);
        const oz = Math.floor(z / depth);

        const lightmap = lightmaps[_getLightmapIndex(ox, oz)];
        return lightmap ? [lightmap] : [];
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

      set(spec) {
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
        this._parent._setShapeData(this, spec);
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

        this._parent = null;
      }

      set(spec) {
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
        this._parent._setShapeData(this, spec);
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

        this._parent = null;
      }

      set(spec) {
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
        this._parent._setShapeData(this, spec);
      }

      getLightmapsInRange(width, depth, lightmaps) {
        const {x, z} = this;
        const ox = Math.floor(x / width);
        const oz = Math.floor(z / depth);

        const lightmap = lightmaps[_getLightmapIndex(ox, oz)];
        return lightmap ? [lightmap] : [];
      }
    }

    class Lightmap extends EventEmitter {
      constructor(x, z) {
        super();

        this.x = x;
        this.z = z;
        this.index = _getLightmapIndex(x, z);

        this.buffer = null;
        const texture = new THREE.DataTexture(
          zeroUint8Array,
          1,
          1,
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
        worker.setShapeData = (id, spec) => {
          worker.postMessage({
            type: 'setShapeData',
            id: id,
            spec: spec,
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
          lightmap.buffer = null;
          lightmap.texture.image.data = zeroUint8Array;
          lightmap.texture.image.width = 1;
          lightmap.texture.image.height = 1;

          queue.push(buffer => {
            lightmap.buffer = buffer;
            lightmap.texture.image.data = new Uint8Array(buffer);
            lightmap.texture.image.width = (width + 1) * (depth + 1);
            lightmap.texture.image.height = height;
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

        this._shapes = [];
        this._lightmaps = {};
        this._buffers = bffr((width + 1) * (depth + 1) * height, 4 * 4 * 2);

        this.chunker = chnkr.makeChunker({
          resolution: NUM_CELLS,
          range: RANGE,
        });

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
        return this.getLightmapAtIndex(Math.floor(x / this.width), Math.floor(z / this.depth));
      }
      getLightmapAtIndex(ox, oz) {
        const {_lightmaps: lightmaps} = this;

        const index = _getLightmapIndex(ox, oz);
        let entry = lightmaps[index];
        if (!entry) {
          entry = new Lightmap(ox, oz);
          entry.on('destroy', () => {
            if (entry.buffer) {
              this._buffers.free(entry.buffer);
              entry.buffer = null;
            }
            lightmaps[index] = null;
            // XXX gc after too many destroys
          });
          lightmaps[index] = entry;
        }
        entry.addRef();
        return entry;
      }

      releaseLightmap(lightmap) {
        lightmap.removeRef();
      }

      getShapes() {
        return this._shapes;
      }

      add(shape) {
        this.worker.addShape(shape);

        this._shapes.push(shape);
        shape._parent = this;

        const {width, depth, _lightmaps: lightmaps} = this;
        const newLightmapsNeedUpdate = shape.getLightmapsInRange(width, depth, lightmaps);
        for (let i = 0; i < newLightmapsNeedUpdate.length; i++) {
          const {x, z} = newLightmapsNeedUpdate[i];
          const chunk = this.chunker.getChunk(x, z);
          if (chunk) {
            chunk.lod = -1;
          }
        }

        this.debouncedUpdate();
      }

      remove(shape) {
        const {id} = shape;
        this.worker.removeShape(id);

        this._shapes.splice(this._shapes.indexOf(shape), 1);

        const {width, depth, _lightmaps: lightmaps} = this;
        const newLightmapsNeedUpdate = shape.getLightmapsInRange(width, depth, lightmaps);
        for (let i = 0; i < newLightmapsNeedUpdate.length; i++) {
          const {x, z} = newLightmapsNeedUpdate[i];
          const chunk = this.chunker.getChunk(x, z);
          if (chunk) {
            chunk.lod = -1;
          }
        }

        this.debouncedUpdate();
      }

      _setShapeData(shape, spec) {
        const {id} = shape;
        this.worker.setShapeData(id, spec);

        const {width, depth, _lightmaps: lightmaps} = this;
        const newLightmapsNeedUpdate = shape.getLightmapsInRange(width, depth, lightmaps);
        for (let i = 0; i < newLightmapsNeedUpdate.length; i++) {
          const {x, z} = newLightmapsNeedUpdate[i];
          const chunk = this.chunker.getChunk(x, z);
          if (chunk) {
            chunk.lod = -1;
          }
        }

        this.debouncedUpdate();
      }

      update() {
        const {hmd} = pose.getStatus();
        const {worldPosition: hmdPosition} = hmd;
        const {added, removed, relodded} = this.chunker.update(hmdPosition.x, hmdPosition.z);

        const addedPromises = Array(added.length + relodded.length);
        let index = 0;
        const _addChunk = chunk => {
          const {x, z, lod} = chunk;

          let {lightmap} = chunk;
          if (!lightmap) {
            lightmap = this.getLightmapAtIndex(x, z);
            chunk.lightmap = lightmap;
          }

          if (!lightmap.buffer) {
            lightmap.buffer = this._buffers.alloc();
          }

          return this.worker.requestUpdate(lightmap);
        };
        for (let i = 0; i < added.length; i++) {
          addedPromises[index++] = _addChunk(added[i]);
        }
        for (let i = 0; i < relodded.length; i++) {
          addedPromises[index++] = _addChunk(relodded[i]);
        }
        return Promise.all(addedPromises)
          .then(() => {
            for (let i = 0; i < removed.length; i++) {
              const {x, z, lightmap} = removed[i];
              if (lightmap.buffer) {
                this._buffers.free(lightmap.buffer);
                lightmap.buffer = null;
                lightmap.texture.image.data = zeroUint8Array;
                lightmap.texture.image.width = 1;
                lightmap.texture.image.height = 1;
              }

              removed.lightmap = null;
              lightmap.removeRef();
            }
          });
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

        const lightmapper = new Lightmapper({
          width: NUM_CELLS,
          height: NUM_CELLS_HEIGHT,
          depth: NUM_CELLS,
        });
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
