const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  HEIGHT_OFFSET,
} = require('./lib/constants/constants');

const FPS = 1000 / 60;

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
        const points = [
          [Math.floor((x - r) / width), Math.floor((z - r) / depth)],
          [Math.floor((x + r) / width), Math.floor((z - r) / depth)],
          [Math.floor((x - r) / width), Math.floor((z + r) / depth)],
          [Math.floor((x + r) / width), Math.floor((z + r) / depth)],
        ];

        const result = [];
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          const [ox, oz] = point;

          const lightmap = lightmaps.find(lightmap => lightmap.x === ox && lightmap.z === oz);
          if (lightmap) {
            result.push(lightmap);
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

      getLightmapsInRange(width, depth, lightmaps) {
        const {x, z, r} = this;
        const points = [
          [Math.floor((x - r) / width), Math.floor((z - r) / depth)],
          [Math.floor((x + r) / width), Math.floor((z - r) / depth)],
          [Math.floor((x - r) / width), Math.floor((z + r) / depth)],
          [Math.floor((x + r) / width), Math.floor((z + r) / depth)],
        ];

        const result = [];
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          const [ox, oz] = point;

          const lightmap = lightmaps.find(lightmap => lightmap.x === ox && lightmap.z === oz);
          if (lightmap) {
            result.push(lightmap);
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
      constructor(x, z, width, height, depth) {
        super();

        this.x = x;
        this.z = z;

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
        const queue = [];
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
        worker.init(width, height, depth, heightOffset);
        this.worker = worker;

        const lightmaps = [];
        this._lightmaps = lightmaps;
        const lightmapsNeedUpdate = [];
        this._lightmapsNeedUpdate = lightmapsNeedUpdate;
      }

      getLightmapAt(x, z) {
        const {width, height, depth, heightOffset, _lightmaps: lightmaps, _lightmapsNeedUpdate: lightmapsNeedUpdate} = this;
        const ox = Math.floor(x / width);
        const oz = Math.floor(z / depth);

        let entry = lightmaps.find(lightmap => lightmap.x === ox && lightmap.z === oz);
        if (!entry) {
          entry = new Lightmap(ox, oz, width, height, depth);
          entry.addRef();
          entry.on('destroy', () => {
            lightmaps.splice(lightmaps.indexOf(entry), 1);

            const needUpdateIndex = lightmapsNeedUpdate.indexOf(entry);
            if (needUpdateIndex !== -1) {
              lightmaps.splice(needUpdateIndex, 1);
            }
          });
          lightmaps.push(entry);
          lightmapsNeedUpdate.push(entry);
        }
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
          const newLightmapNeedsUpdate = newLightmapsNeedUpdate[i];
          if (!lightmapsNeedUpdate.includes(newLightmapNeedsUpdate)) {
            lightmapsNeedUpdate.push(newLightmapNeedsUpdate);
          }
        }
      }

      remove(shape) {
        const {id} = shape;
        this.worker.removeShape(id);

        const {width, depth, _lightmaps: lightmaps, _lightmapsNeedUpdate: lightmapsNeedUpdate} = this;
        const newLightmapsNeedUpdate = shape.getLightmapsInRange(width, depth, lightmaps);
        for (let i = 0; i < newLightmapsNeedUpdate.length; i++) {
          const newLightmapNeedsUpdate = newLightmapsNeedUpdate[i];
          if (!lightmapsNeedUpdate.includes(newLightmapNeedsUpdate)) {
            lightmapsNeedUpdate.push(newLightmapNeedsUpdate);
          }
        }
      }

      update() {
        const {_lightmapsNeedUpdate: lightmapsNeedUpdate} = this;

        if (lightmapsNeedUpdate.length > 0) {
          const {worker, _lightmaps: lightmaps} = this;

          return Promise.all(lightmapsNeedUpdate.map(lightmap => worker.requestUpdate(lightmap)))
            .then(() => {
              lightmapsNeedUpdate.length = 0;
            });
        } else {
          return Promise.resolve();
        }
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

        let live = true;
        const _recurse = () => {
          lightmapper.update()
            .then(() => {
              if (live) {
                setTimeout(_recurse, FPS);
              }
            })
            .catch(err => {
              if (live) {
                console.warn(err.stack);

                setTimeout(_recurse, FPS);
              }
            });
        };
        _recurse();

        entityElement._cleanup = () => {
          live = false;
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
