const chnkr = require('chnkr');

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
    const {three, render, pose, teleport, physics, utils: {geometry: geometryUtils}} = zeo;
    const {THREE, scene, camera} = three;

    const mapChunkMaterial = new THREE.MeshPhongMaterial({
      // color: 0xFFFFFF,
      shininess: 0,
      shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      // side: THREE.DoubleSide,
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
        let geometry = new THREE.BufferGeometry();
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

      mesh.destroy = () => {
        geometry.dispose();
      };

      return mesh;
    };

    const object = new THREE.Object3D();
    scene.add(object);

    const chunker = chnkr.makeChunker({
      resolution: 32,
      lods: 3,
    });

    const _requestRefreshMapChunks = () => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

      const addedPromises = added.map(chunk => {
        const {x, z} = chunk;

        return _requestGenerate(x, z)
          .then(mapChunkBuffer => {
            const mapChunkData = protocolUtils.parseMapChunk(mapChunkBuffer);
            const mapChunkMesh = _makeMapChunkMesh(mapChunkData);
            object.add(mapChunkMesh);

            const teleportMesh = mapChunkMesh.clone();
            teleportMesh.geometry = geometryUtils.unindexBufferGeometry(teleportMesh.geometry.clone()); // teleport needs unindexed but physics needs indexed
            mapChunkMesh.teleportMesh = teleportMesh;
            teleport.addTarget(teleportMesh, {
              flat: true,
            });

            const physicsBody = physics.makeBody(mapChunkMesh, 'heightfield:' + x + ':' + z, {
              mass: 0,
              position: [
                (NUM_CELLS / 2) + (x * NUM_CELLS),
                0,
                (NUM_CELLS / 2) + (z * NUM_CELLS)
              ],
              linearFactor: [0, 0, 0],
              angularFactor: [0, 0, 0],
              bindObject: false,
              bindConnection: false,
            });
            mapChunkMesh.physicsBody = physicsBody;

            chunk.data = mapChunkMesh;
          });
      });
      return Promise.all(addedPromises)
        .then(() => {
          removed.forEach(chunk => {
            const {data: mapChunkMesh} = chunk;
            object.remove(mapChunkMesh);
            mapChunkMesh.destroy();

            const {teleportMesh} = mapChunkMesh;
            teleport.removeTarget(teleportMesh);

            const {physicsBody} = mapChunkMesh;
            physics.destroyBody(physicsBody);
          });
        })
        .then(() => {
          if (added.length > 0 || removed.length > 0) {
            teleport.reindex();
          }
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
