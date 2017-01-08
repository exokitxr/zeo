const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const DIRECTIONS = [
  [-1,-1],
  [-1,0],
  [-1,1],
  [0,-1],
  [0,0],
  [0,1],
  [1,-1],
  [1,0],
  [1,1],
];

class MapPlugin {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;

        return archae.requestWorker(this, {
          count: 4,
        })
          .then(worker => {
            if (live) {
              const mapChunkMaterial = new THREE.MeshLambertMaterial({
                color: 0xFFFFFF,
                // emissive: 0x333333,
                // specular: 0x000000,
                // shininess: 0,
                // side: THREE.DoubleSide,
                shading: THREE.FlatShading,
                vertexColors: THREE.VertexColors,
              });

              const _makeMapChunkMesh = mapChunkData => {
                const {position, positions, normals, colors, boundingSphere} = mapChunkData;

                const geometry = (() => {
                  const geometry = new THREE.BufferGeometry();

                  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                  geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
                  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

                  geometry.computeBoundingSphere();

                  return geometry;
                })();
                const material = mapChunkMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.frustumCulled = false;
                return mesh;
              };

              const object = new THREE.Object3D();
              scene.add(object);

              cleanups.push(() => {
                scene.remove(object);

                worker.terminate();
              });

              const currentMapChunks = new Map();

              class MapChunk {
                constructor(offset, mesh) {
                  this.offset = offset;
                  this.mesh = mesh;
                }
              }

              const _getMapChunkOffsetKey = (x, y) => x + ',' + y;
              const _requestRefreshMapChunks = () => {
                const {position: cameraPosition} = camera;
                const cameraMapChunkOffset = [Math.floor(cameraPosition.x / NUM_CELLS), Math.floor(cameraPosition.z / NUM_CELLS)];

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
                  return worker.request('generate', [
                    {
                      offset: {
                        x,
                        y,
                      },
                      position: {
                        x: x * NUM_CELLS,
                        y: y * NUM_CELLS,
                      },
                    }
                  ]).then(({mapChunk: mapChunkBuffer}) => {
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

                  return {
                    update: _update,
                  };
                });
            } else {
              worker.terminate();
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = MapPlugin;
