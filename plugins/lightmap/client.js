const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  HEIGHT_OFFSET,
} = require('./lib/constants/constants');

class Lightmap {
  mount() {
    const {three, elements, render, utils: {js: jsUtils}} = zeo;
    const {THREE} = three;
    const {events} = jsUtils;
    const {EventEmitter} = events;

    let idCount = 0;

    class Ambient {
      constructor(v, blend = Lightmapper.AddBlend) {
        this.type = 'ambient';

        this.id = idCount++;
        this.v = v;
        this.blend = blend;
      }

      getLightmapIndexesInRange(width, depth, lightmaps) {
        return Object.keys(lightmaps);
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

      getLightmapIndexesInRange(width, depth, lightmaps) {
        const {x, z, r} = this;
        const points = [
          [Math.floor((x - r) / width), Math.floor((z - r) / depth)],
          [Math.floor((x + r) / width), Math.floor((z - r) / depth)],
          [Math.floor((x - r) / width), Math.floor((z + r) / depth)],
          [Math.floor((x + r) / width), Math.floor((z + r) / depth)],
        ];

        const result = {};
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          const [ox, oz] = point;
          const index = ox + ':' + oz;
          const lightmap = lightmaps[index];

          if (lightmap) {
            result[index] = true;
          }
        }
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

      getLightmapIndexesInRange(width, depth, lightmaps) {
        const {x, z, r} = this;
        const points = [
          [Math.floor((x - r) / width), Math.floor((z - r) / depth)],
          [Math.floor((x + r) / width), Math.floor((z - r) / depth)],
          [Math.floor((x - r) / width), Math.floor((z + r) / depth)],
          [Math.floor((x + r) / width), Math.floor((z + r) / depth)],
        ];

        const result = {};
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          const [ox, oz] = point;
          const index = ox + ':' + oz;
          const lightmap = lightmaps[index];

          if (lightmap) {
            result[index] = true;
          }
        }
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

      getLightmapIndexesInRange(width, depth, lightmaps) {
        const {x, z} = this;

        const result = {};
        const index = ox + ':' + oz;
        const lightmap = lightmaps[index];
        if (lightmap) {
          result[index] = true;
        }
        return result;
      }
    }

    class Lightmap extends EventEmitter {
      constructor(width, height, depth) {
        super();

        const buffer = new ArrayBuffer((width + 1) * (depth + 1) * height);
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
        // this.buffer = null;

        this.texture.dispose();
        // this.texture = null;

        this.emit('destroy');
      }
    }

    class Lightmapper {
      constructor({width = 32 + 1, height = 128, depth = 32 + 1, heightOffset = -32} = {}) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.heightOffset = heightOffset;

        const worker = new Worker('archae/plugins/_plugins_lightmap/build/worker.js');
        const queue = {};
        worker.init = (width, height, depth, heightOffset) => {
          worker.postMessage({
            type: 'init',
            width,
            height,
            depth,
            heightOffset,
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
        worker.requestUpdate = (ox, oz, buffer) => new Promise((accept, reject) => {
          worker.postMessage({
            type: 'requestUpdate',
            ox,
            oz,
            buffer,
          }, [buffer]);

          const index = ox + ':' + oz;
          queue[index] = buffer => {
            const lightmap = lightmaps[index];
            if (lightmap) {
              lightmap.buffer = buffer;
              lightmap.texture.image.data.set(new Uint8Array(buffer));
              lightmap.texture.needsUpdate = true;
            }

            accept();
          };
        });
        worker.onmessage = e => {
          const {data: {ox, oz, buffer}} = e;
          const index = ox + ':' + oz;
          const entry = queue[index];
          entry(buffer);
        };
        worker.init(width, height, depth, heightOffset);
        this.worker = worker;

        const lightmaps = {};
        this._lightmaps = lightmaps;
        const lightmapsNeedUpdate = {};
        this._lightmapsNeedUpdate = lightmapsNeedUpdate;
      }

      getLightmapAt(x, z) {
        const {width, height, depth, heightOffset, _lightmaps: lightmaps, _lightmapsNeedUpdate: lightmapsNeedUpdate} = this;
        const ox = Math.floor(x / width);
        const oz = Math.floor(z / depth);
        const index = ox + ':' + oz;

        let entry = lightmaps[index];
        if (!entry) {
          entry = new Lightmap(width, height, depth);
          entry.addRef();
          entry.on('destroy', () => {
            delete lightmaps[index];
          });
          lightmaps[index] = entry;
          lightmapsNeedUpdate[index] = true;
        }
        return entry;
      }

      releaseLightmap(lightmap) {
        lightmap.removeRef();
      }

      add(shape) {
        this.worker.addShape(shape);

        const {width, depth, _lightmaps: lightmaps, _lightmapsNeedUpdate: lightmapsNeedUpdate} = this;
        Object.assign(lightmapsNeedUpdate, shape.getLightmapIndexesInRange(width, depth, lightmaps));
      }

      remove(shape) {
        const {id} = shape;
        this.worker.removeShape(id);

        const {width, depth, _lightmaps: lightmaps, _lightmapsNeedUpdate: lightmapsNeedUpdate} = this;
        Object.assign(lightmapsNeedUpdate, shape.getLightmapIndexesInRange(width, depth, lightmaps));
      }

      removes(shapes) {
        this.worker.removeShapes(shapes.map(({id}) => id));

        const {width, depth, _lightmaps: lightmaps, _lightmapsNeedUpdate: lightmapsNeedUpdate} = this;
        for (let i = 0; i < shapes.length; i++) {
          const shape = shapes[i];
          Object.assign(lightmapsNeedUpdate, shape.getLightmapIndexesInRange(width, depth, lightmaps));
        }
      }

      update() {
        const {worker, _lightmaps: lightmaps, _lightmapsNeedUpdate: lightmapsNeedUpdate} = this;

        let promises = [];
        for (const index in lightmapsNeedUpdate) {
          const lightmap = lightmaps[index];

          if (lightmap) {
            const [ox, oz] = index.split(':').map(s => parseInt(s, 10));
            const {buffer} = lightmap;
            const promise = worker.requestUpdate(ox, oz, buffer)
              .then(() => {
                delete lightmapsNeedUpdate[index];
              });
            promises.push(promise);
          }
        }

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
          heightOffset: HEIGHT_OFFSET,
        });
        lightmapper.add(new Lightmapper.Ambient(255 * 0.5));
        lightmapper.add(new Lightmapper.Sphere(0, 32, 0, 8, 2, Lightmapper.MaxBlend));
        entityElement.lightmapper = lightmapper;

        let updating = false;
        const _update = () => {
          if (!updating) {
            lightmapper.update()
              .then(() => {
                updating = false;
              })
              .catch(err => {
                console.warn(err.stack);

                updating = false;
              });

            updating = true;
          }
        };
        render.on('update', _update);

        entityElement._cleanup = () => {
          render.removeListener('update', _update);
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

module.exports = Lightmap;
