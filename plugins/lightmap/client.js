const needsUpdateSymbol = Symbol();
const initialColorsSymbol = Symbol();

class Lightmap {
  mount() {
    const {three, elements, utils: {js: jsUtils}} = zeo;
    const {THREE} = three;
    const {events} = jsUtils;
    const {EventEmitter} = events;

    class Ambient {
      constructor(v) {
        this.type = 'ambient';

        this.v = v;

        this.needsUpdate = true;
      }
    }
    class Sphere {
      constructor(x, y, z, r, v) {
        this.type = 'sphere';

        this.x = x;
        this.y = y;
        this.z = z;
        this.r = r;
        this.v = v;

        this.needsUpdate = true;
      }
    }
    class Voxel {
      constructor(x, y, z, v) {
        this.type = 'voxel';

        this.x = x;
        this.y = y;
        this.z = z;
        this.v = v;

        this.needsUpdate = true;
      }
    }

    class Lightmap extends EventEmitter {
      constructor(ox, oz, width, height, depth, heightOffset) {
        super();

        this.ox = ox;
        this.oz = oz;
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.heightOffset = heightOffset;

        const lightmap = new Uint8Array((width + 1) * (depth + 1) * height);
        this.lightmap = lightmap;
        const texture = new THREE.DataTexture(
          lightmap,
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
        // texture.needsUpdate = true;
        this.texture = texture;
        this.rendered = false;
        this.refCount = 0;
      }

      update(shapes) {
        const {ox, oz, width, height, depth, heightOffset, lightmap, texture, rendered} = this;

        const _renderShapes = force => {
          let updated = false;
          const _initializeUpdate = () => {
            const ambientValue = (() => {
              let result = 0;
              for (let i = 0; i < shapes.length; i++) {
                const shape = shapes[i];
                if (shape.type === 'ambient') {
                  result += shape.v;
                }
              }
              return result;
            })();

            lightmap.fill(ambientValue);

            texture.needsUpdate = true;
          };

          if (force) {
            _initializeUpdate();
            updated = true;
          }

          for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];

            if (shape.needsUpdate) {
              const {type} = shape;

              switch (type) {
                case 'sphere': {
                  const {x, y, z, r, v} = shape;
                  const ax = x - (ox * width);
                  const ay = y - heightOffset;
                  const az = z - (oz * depth);

                  const dr = r - 1;
                  const maxDistance = Math.sqrt(dr*dr*3);
                  for (let dx = -dr; dx <= dr; dx++) {
                    for (let dy = -dr; dy <= dr; dy++) {
                      for (let dz = -dr; dz <= dr; dz++) {
                        const lx = Math.floor(ax + dx);
                        const ly = Math.floor(ay + dy);
                        const lz = Math.floor(az + dz);

                        if (_isInRange(lx, width + 1) && _isInRange(ly, height) && _isInRange(lz, depth + 1)) {
                          if (!updated) {
                            _initializeUpdate();
                            updated = true;
                          }

                          const distanceFactor = (maxDistance - new THREE.Vector3(dx, dy, dz).length()) / maxDistance;
                          const lightmapIndex = lx + (lz * (width + 1)) + (ly * (width + 1) * (depth + 1));
                          lightmap[lightmapIndex] = Math.max(
                            Math.min(distanceFactor * distanceFactor * v, 1) * 255,
                            lightmap[lightmapIndex]
                          );
                        }
                      }
                    }
                  }

                  break;
                }
                case 'voxel': {
                  const {x, y, z, r} = shape;
                  const ax = x - (ox * width);
                  const ay = y - heightOffset;
                  const az = z - (ox * height);

                  if (_isInRange(ax, width + 1) && _isInRange(ay, height) && _isInRange(az, depth + 1)) {
                    if (!updated) {
                      _initializeUpdate();
                      updated = true;
                    }

                    const lightmapIndex = ax + (az * (width + 1)) + (ay * (width + 1) * (depth + 1));
                    lightmap[lightmapIndex] = Math.max(v, lightmap[lightmapIndex]);
                  }
                }
              }
            }
          }
        };

        const forceShapesUpdate = !rendered;
        _renderShapes(forceShapesUpdate);
        if (!rendered) {
          this.rendered = true;
        }
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
        this.emit('destroy');
      }
    }

    class Lightmapper {
      constructor({width = 32 + 1, height = 128, depth = 32 + 1, heightOffset = -32} = {}) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.heightOffset = heightOffset;

        this._lightmaps = {};
        this._shapes = [];
      }

      getLightmapAt(x, z) {
        const {width, height, depth, heightOffset, _lightmaps: lightmaps} = this;
        const ox = Math.floor(x / width);
        const oz = Math.floor(z / depth);
        const index = ox + ':' + oz;
        let entry = lightmaps[index];
        if (!entry) {
          entry = new Lightmap(ox, oz, width, height, depth, heightOffset);
          entry.addRef();
          entry.on('destroy', () => {
            delete lightmaps[index];
          });
          lightmaps[index] = entry;
        }
        return entry;
      }

      releaseLightmap(lightmap) {
        lightmap.removeRef();
      }

      add(shape) {
        this._shapes.push(shape);
      }

      remove(shape) {
        this._shapes.splice(this._shapes.indexOf(shape), 1);
      }

      update() {
        const {width, depth, height, heightOffset, _lightmaps: lightmaps, _shapes: shapes} = this;

        for (const index in lightmaps) {
          const lightmap = lightmaps[index];
          lightmap.update(shapes);
        }

        for (let i = 0; i < shapes.length; i++) {
          const shape = shapes[i];
          if (shape.needsUpdate) {
            shape.needsUpdate = false;
          }
        }
      }
    };
    Lightmapper.Ambient = Ambient;
    Lightmapper.Sphere = Sphere;
    Lightmapper.Voxel = Voxel;

    const lightmapEntity = {
      entityAddedCallback(entityElement) {
        entityElement.Lightmapper = Lightmapper;
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
const _clamp = (n, l) => Math.min(Math.max(n, 0), l);
const _isInRange = (n, l) => n >= 0 && n <= l;

module.exports = Lightmap;
