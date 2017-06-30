const chnkr = require('chnkr');

const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 2000 * 1000;

class Grass {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose} = zeo;
    const {THREE, scene, camera} = three;

    const upVector = new THREE.Vector3(0, 1, 0);

    const grassMaterial = new THREE.MeshBasicMaterial({
      // color: 0xFFFFFF,
      // shininess: 0,
      // shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      side: THREE.DoubleSide,
    });

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _resArrayBuffer = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.arrayBuffer();
      } else {
        const err = new Error('invalid status code: ' + res.status);
        return Promise.reject(err);
      }
    };
    const _requestGrassGenerate = (x, y) => fetch(`archae/grass/generate?x=${x}&y=${y}`)
      .then(_resArrayBuffer)
      .then(grassChunkBuffer => protocolUtils.parseGrassGeometry(grassChunkBuffer));
    /* const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    }; */

    const _makeGrassChunkMesh = (mapChunkData, x, z) => {
      const {positions, colors, heightRange} = mapChunkData;

      const geometry = (() => {
        let geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        const [minY, maxY] = heightRange;
        geometry.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(
            (x * NUM_CELLS) + (NUM_CELLS / 2),
            (minY + maxY) / 2,
            (z * NUM_CELLS) + (NUM_CELLS / 2)
          ),
          Math.max(Math.sqrt((NUM_CELLS / 2) * (NUM_CELLS / 2) * 2), (maxY - minY) / 2)
        );

        return geometry;
      })();
      const material = grassMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      // mesh.frustumCulled = false;
      mesh.drawMode = THREE.TriangleStripDrawMode;

      mesh.destroy = () => {
        geometry.dispose();
      };

      return mesh;
    };

    const chunker = chnkr.makeChunker({
      resolution: 32,
      range: 2,
      useLods: false,
    });

    /* const _makeGrassMesh = grassPositions => {
      const positions = new Float32Array(NUM_POSITIONS * 3);
      const colors = new Float32Array(NUM_POSITIONS * 3);
      let attributeIndex = 0;

      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3(1, 1, 1);
      const matrix = new THREE.Matrix4();

      const numGrassPositions = grassPositions.length / 3;
      for (let i = 0; i < numGrassPositions; i++) {
        const baseIndex = i * 3;
        position.set(
          grassPositions[baseIndex + 0],
          grassPositions[baseIndex + 1],
          grassPositions[baseIndex + 2]
        );
        quaternion.setFromAxisAngle(upVector, Math.random() * Math.PI * 2);
        matrix.compose(position, quaternion, scale);
        const geometry = grassGeometry
          .clone()
          .applyMatrix(matrix);
        const newPositions = geometry.getAttribute('position').array;
        positions.set(newPositions, attributeIndex);
        const newColors = geometry.getAttribute('color').array;
        colors.set(newColors, attributeIndex);

        attributeIndex += newPositions.length;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, attributeIndex), 3));

      const material = grassMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      // mesh.position.y = 0.5;
      // mesh.updateMatrixWorld();
      // mesh.frustumCulled = false;
      mesh.drawMode = THREE.TriangleStripDrawMode;

      mesh.destroy = () => {
        geometry.dispose();
      };

      return mesh;
    }; */

    const _requestRefreshGrassChunks = () => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

      const addedPromises = added.map(chunk => {
        const {x, z} = chunk;

        return _requestGrassGenerate(x, z)
          .then(grassChunkData => {
            const grassChunkMesh = _makeGrassChunkMesh(grassChunkData, x, z);
            scene.add(grassChunkMesh);

            chunk.data = grassChunkMesh;
          });
      });
      return Promise.all(addedPromises)
        .then(() => {
          removed.forEach(chunk => {
            const {data: grassChunkMesh} = chunk;
            scene.remove(grassChunkMesh);
            grassChunkMesh.destroy();
          });
        })
    };

    return _requestRefreshGrassChunks()
      .then(() => {
        let updating = false;
        let updateQueued = false;
        const tryGrassChunkUpdate = () => {
          if (!updating) {
            updating = true;

            const done = () => {
              updating = false;

              if (updateQueued) {
                updateQueued = false;

                tryGrassChunkUpdate();
              }
            };

            _requestRefreshGrassChunks()
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
          tryGrassChunkUpdate();
        };
        render.on('update', _update);

        this._cleanup = () => {
          // XXX remove old grass meshes here

          grassMaterial.dispose();

          render.removeListener('update', _update);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Grass;
