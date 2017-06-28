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

    const grassColors = (() => {
      const result = new Float32Array(9 * 3);
      const baseColor = new THREE.Color(0x8db360);
      for (let i = 0 ; i < 9; i++) {
        const c = baseColor.clone().multiplyScalar(0.1 + (((i + 1) / 9) * 0.9));
        result[(i * 3) + 0] = c.r;
        result[(i * 3) + 1] = c.g;
        result[(i * 3) + 2] = c.b;
      }
      return result;
    })();
    const grassGeometries = [
      (() => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(9 * 3);

        positions[0] = 0;
        positions[1] = 0;
        positions[2] = 0;

        positions[3] = 0;
        positions[4] = 0;
        positions[5] = 0;

        positions[6] = 0.01;
        positions[7] = 0;
        positions[8] = 0;

        positions[9] = 0.005;
        positions[10] = 0.02;
        positions[11] = 0;

        positions[12] = 0.015;
        positions[13] = 0.02;
        positions[14] = 0;

        positions[15] = 0.0125;
        positions[16] = 0.04;
        positions[17] = 0;

        positions[18] = 0.02;
        positions[19] = 0.04;
        positions[20] = 0;

        positions[21] = 0.03;
        positions[22] = 0.06;
        positions[23] = 0;

        positions[24] = 0.03;
        positions[25] = 0.06;
        positions[26] = 0;

        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(grassColors, 3));

        return geometry;
      })(),
      (() => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(9 * 3);

        positions[0] = 0;
        positions[1] = 0.02;
        positions[2] = 0;

        positions[3] = 0;
        positions[4] = 0.02;
        positions[5] = 0;

        positions[6] = 0.01;
        positions[7] = 0.01;
        positions[8] = 0;

        positions[9] = 0.01;
        positions[10] = 0;
        positions[11] = -0.001;

        positions[12] = 0.02;
        positions[13] = 0;
        positions[14] = 0;

        positions[15] = 0.02;
        positions[16] = 0.02;
        positions[17] = 0;

        positions[18] = 0.03;
        positions[19] = 0.02;
        positions[20] = 0;

        positions[21] = 0.04;
        positions[22] = 0.03;
        positions[23] = 0;

        positions[24] = 0.04;
        positions[25] = 0.03;
        positions[26] = 0;

        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(grassColors, 3));

        return geometry;
      })(),
    ];

    const grassMesh = (() => {
      const numPatches = 100;
      const numGrassesPerPatch = 100;
      // const numPatches = 1;
      // const numGrassesPerPatch = 1;
      const positions = new Float32Array(numPatches * numGrassesPerPatch * 9 * 3);
      const colors = new Float32Array(numPatches * numGrassesPerPatch * 9 * 3);
      for (let i = 0; i < numPatches; i++) {
        const patchPosition = new THREE.Vector3(
          -10 + (Math.random() * 20),
          0,
          -10 + (Math.random() * 20)
        );

        for (let j = 0; j < numGrassesPerPatch; j++) {
          const baseIndex = (i * numGrassesPerPatch * 9 * 3) + (j * 9 * 3);
          const geometry = grassGeometries[Math.floor(Math.random() * grassGeometries.length)]
            .clone()
            .applyMatrix(new THREE.Matrix4().makeScale(1 + Math.random() * 2, 2 + Math.random() * 6, 1 + Math.random() * 2))
            .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0, camera.rotation.order)))
            .applyMatrix(new THREE.Matrix4().makeTranslation(
              patchPosition.x + (-1 + (Math.random() * 1)),
              0,
              patchPosition.z + (-1 + (Math.random() * 1))
            ));
          const newPositions = geometry.getAttribute('position').array;
          const newColors = geometry.getAttribute('color').array;
          positions.set(newPositions, baseIndex);
          colors.set(newColors, baseIndex);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.MeshBasicMaterial({
        // color: 0xFFFFFF,
        // shininess: 0,
        // shading: THREE.FlatShading,
        vertexColors: THREE.VertexColors,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.75;
      mesh.updateMatrixWorld();
      mesh.drawMode = THREE.TriangleStripDrawMode;
      return mesh;
    })();
    scene.add(grassMesh);

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
          scene.add(grassMesh);
          render.removeListener('update', _update);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Heightfield;
