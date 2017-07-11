const DIRECTIONS = (() => {
  const result = [];
  for (let x = -1; x <= 1; x++) {
    if (x !== 0) {
      for (let y = -1; y <= 1; y++) {
        if (y !== 0) {
          for (let z = -1; z <= 1; z++) {
            if (z !== 0) {
              result.push([x, y, z]);
            }
          }
        }
      }
    }
  }
  return result;
})();

const needsUpdateSymbol = Symbol();

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
if (ox === 0 && oz === 0) {
window.lightmap = this;
}

        this.ox = ox;
        this.oz = oz;
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.heightOffset = heightOffset;

        this.lightmap = new Uint8Array(width * height * depth);
        this.meshes = [];
        this.rendered = false;
        this.refCount = 0;
      }

      add(mesh) {
        mesh[needsUpdateSymbol] = true;

        this.meshes.push(mesh);
      }

      remove(mesh) {
        mesh[needsUpdateSymbol] = false;

        this.meshes.splice(this.meshes.indexOf(mesh), 1);
      }

      update(shapes) {
        const {ox, oz, width, height, depth, heightOffset, lightmap, meshes, rendered} = this;

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

          return updated;
        };
        const _renderMeshes = force => { // XXX this should be moved up a layer
          if (meshes.length > 0) {
            const x = this.ox * this.width;
            const z = this.oz * this.depth;

            for (let i = 0; i < meshes.length; i++) {
              const mesh = meshes[i];

              if (mesh[needsUpdateSymbol] || force) {
                const {geometry} = mesh;
                const positions = geometry.getAttribute('position').array;
                const colorAttribute = geometry.getAttribute('color');
                const colors = colorAttribute.array;
                const {initialColors} = geometry;
                const numPositions = positions.length / 3;

                for (let j = 0; j < numPositions; j++) {
                  const baseIndex = j * 3;
                  const ax = _clamp(Math.floor(positions[baseIndex + 0] - x), width);
                  const ay = _clamp(Math.floor(positions[baseIndex + 1] - heightOffset), height);
                  const az = _clamp(Math.floor(positions[baseIndex + 2] - z), depth);
                  const lightmapIndex = ax + (az * (width + 1)) + (ay * (width + 1) * (depth + 1));
                  const v = lightmap[lightmapIndex] / 255;

                  colors[baseIndex + 0] = initialColors[baseIndex + 0] * v;
                  colors[baseIndex + 1] = initialColors[baseIndex + 1] * v;
                  colors[baseIndex + 2] = initialColors[baseIndex + 2] * v;
                }

                colorAttribute.needsUpdate = true;

                if (mesh[needsUpdateSymbol]) {
                  mesh[needsUpdateSymbol] = false;
                }
              }
            }
          }
        };

        const forceShapesUpdate = !rendered;
        const lightmapUpdated = _renderShapes(forceShapesUpdate);
        _renderMeshes(lightmapUpdated);
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
        const index = ox + (oz * width);
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
        const {_lightmaps: lightmaps, _shapes: shapes} = this;

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
