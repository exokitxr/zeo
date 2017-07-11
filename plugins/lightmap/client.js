class Lightmap {
  /* constructor(archae) {
    this._archae = archae;
  } */

  mount() {
    // const {_archae: archae} = this;
    const {elements, utils: {js: jsUtils}} = zeo;
    const {events} = jsUtils;
    const {EventEmitter} = events;

    class Lightmap extends EventEmitter {
      constructor(ox, oz, width, height, depth, heightOffset) {
        super();

        this.ox = ox;
        this.oz = oz;
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.heightOffset = heightOffset;

        this.lightmap = new Uint8Array(width * height * depth);
        this.ambient = 0;
        this.needsUpdate = true;
        this.refCount = 0;
      }

      setAmbient(ambient) {
        this.ambient = ambient;

        this.needsUpdate = true;
      }

      setVoxel(x, y, z, v) {
        const {ox, oz, width, height, depth, heightOffset, lightmap} = this;
        const ax = x - (ox * width);
        const ay = y - heightOffset;
        const az = z - (ox * height);

        const lightmapIndex = ax + (az * (width + 1)) + (ay * (width + 1) * (depth + 1));
        lightmap[lightmapIndex] = v;
      }

      addSphere(x, y, z, r) {
        const {ox, oz, width, height, depth, heightOffset, lightmap} = this;
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
                const lightmapIndex = lx + (lz * (width + 1)) + (ly * (width + 1) * (depth + 1));
                lightmap[lightmapIndex] = Math.max(
                  (maxDistance - new THREE.Vector3(dx, dy, dz).length()) / maxDistance * 255,
                  lightmap[lightmapIndex]
                );
              }
            }
          }
        }

        this.needsUpdate = true;
      }
      
      resetLightmap() {
        this.lightmap.fill(0);

        this.needsUpdate = true;
      }

      bakeGeometry(geometry) {
        const {width, height, depth, heightOffset} = this;

        const positions = geometry.getAttribute('position').array;
        const colorAttribute = geometry.getAttribute('color');
        const colors = colorAttribute.array;
        const {initialColors} = geometry;
        const numPositions = positions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          const baseIndex = i * 3;
          const x = _clamp(Math.floor(positions[baseIndex + 0]), width);
          const y = _clamp(Math.floor(positions[baseIndex + 1] - heightOffset), height);
          const z = _clamp(Math.floor(positions[baseIndex + 2]), depth);
          const lightmapIndex = x + (y * (width + 1)) + (z * (width + 1) * (depth + 1));
          const v = (lightmap[lightmapIndex] + ambient) / 255;

          colors[baseIndex + 0] = initialColors[baseIndex + 0] * v;
          colors[baseIndex + 1] = initialColors[baseIndex + 1] * v;
          colors[baseIndex + 2] = initialColors[baseIndex + 2] * v;
        }

        colorAttribute.needsUpdate = true;
      }

      update() {
        if (this.needsUpdate) {
          this.emit('update');

          this.needsUpdate = false;
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
      }

      getLightmapAt(x, z) {
        const {width, height, depth, heightOffset, _lightmaps: lightmaps} = this;
        const ox = Math.floor(x / width);
        const oz = Math.floor(z / depth);
        const index = ox + (oz * width);
        let entry = lightmaps[index];
        if (!entry) {
          entry = new Lightmap(ox, oz);
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

      // XXX add addSphere support that sets across chunks

      update() {
        const {_lightmaps: lightmaps} = this;

        for (const index in lightmaps) {
          const lightmap = lightmaps[index];
          lightmap.update();
        }
      }
    };

    const lightmapEntity = {
      // attributes: {},
      entityAddedCallback(entityElement) {
console.log('set lightmap entity element', this, entityElement); // XXX
        entityElement.makeLightmapper = options => new Lightmapper(options);
      },
      /* entityRemovedCallback(entityElement) {
      }, */
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
