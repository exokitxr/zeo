const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const DIRECTIONS = (() => {
  const result = [];
  const size = 3;
  for (let x = -size; x <= size; x++) {
    for (let y = -size; y <= size; y++) {
      result.push([x, y]);
    }
  }
  return result;
})();

class Heightfield {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose} = zeo;
    const {THREE, scene, camera} = three;

    const mapChunkMaterial = new THREE.MeshPhongMaterial({
      // color: 0xFFFFFF,
      shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
    });

    const _requestGenerate = (x, y) => fetch(`/archae/heightfield/generate?x=${x}&y=${y}`)
      .then(res => {
        if (res.status >= 200 && res.status < 300) {
          return res.arrayBuffer();
        } else {
          const err = new Error('invalid status code: ' + res.status);
          return Promise.reject(err);
        }
      });

    const _makeMapChunkMesh = mapChunkData => {
      const {position, positions, normals, colors, indices} = mapChunkData;

      const geometry = (() => {
        const geometry = new THREE.BufferGeometry();

        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(new THREE.Uint16BufferAttribute(indices, 1));

        // geometry.computeBoundingSphere();

        return geometry;
      })();
      const material = mapChunkMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      // mesh.frustumCulled = false;
      return mesh;
    };

    const object = new THREE.Object3D();
    scene.add(object);

    const currentMapChunks = new Map();

    class MapChunk {
      constructor(offset, mesh) {
        this.offset = offset;
        this.mesh = mesh;
      }
    }

    const _getMapChunkOffsetKey = (x, y) => x + ',' + y;
    const _requestRefreshMapChunks = () => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const cameraMapChunkOffset = [Math.floor(hmdPosition.x / NUM_CELLS), Math.floor(hmdPosition.z / NUM_CELLS)];

      const requiredMapChunkOffsets = DIRECTIONS.map(([x, y]) => ([cameraMapChunkOffset[0] + x, cameraMapChunkOffset[1] + y]));
      const missingMapChunkOffsets = requiredMapChunkOffsets.filter(([x, y]) => {
        const key = _getMapChunkOffsetKey(x, y);
        return !currentMapChunks.has(key);
      });
      const deadMapChunkOffsets = (() => {
        const result = [];
        currentMapChunks.forEach(currentMapChunk => {
          const {offset} = currentMapChunk;
          if (!requiredMapChunkOffsets.some(([x, y]) => x === offset[0] && y === offset[1])) {
            result.push([offset[0], offset[1]]);
          }
        });
        return result;
      })();

      const missingMapChunkPromises = missingMapChunkOffsets.map(([x, y]) => {
        return _requestGenerate(x, y)
          .then(mapChunkBuffer => {
            const mapChunkData = protocolUtils.parseMapChunk(mapChunkBuffer);
            const mesh = _makeMapChunkMesh(mapChunkData);
            object.add(mesh);

            const key = _getMapChunkOffsetKey(x, y);
            const mapChunk = new MapChunk([x, y], mesh);
            currentMapChunks.set(key, mapChunk);
          });
      });
      return Promise.all(missingMapChunkPromises)
        .then(() => {
          deadMapChunkOffsets.forEach(([x, y]) => {
            const key = _getMapChunkOffsetKey(x, y);
            const mapChunk = currentMapChunks.get(key);
            const {mesh} = mapChunk;
            object.remove(mesh);

            currentMapChunks.delete(key);
          });
        });
    };

    return _requestRefreshMapChunks()
      .then(() => {
        let updating = false;
        let updateQueued = false;
        const tryMapChunkUpdate = () => {
          if (!updating) {
            updating = true;

            const done = () => {
              updating = false;

              if (updateQueued) {
                updateQueued = false;

                tryMapChunkUpdate();
              }
            };

            _requestRefreshMapChunks()
              .then(done)
              .catch(err => {
                console.warn(err);

                done();
              });
          } else {
            updateQueued = true;
          }
        };

        const _update = () => {
          tryMapChunkUpdate();
        };
        render.on('update', _update);

        this._cleanup = () => {
          scene.remove(object);
          render.removeListener('update', _update);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Heightfield;
