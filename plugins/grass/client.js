const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const TEXTURE_SIZE = 1024;
const NUM_POSITIONS_CHUNK = 200 * 1024;

class Grass {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, utils: {random: {chnkr}}} = zeo;
    const {THREE, scene} = three;

    const upVector = new THREE.Vector3(0, 1, 0);

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const worker = new Worker('archae/plugins/_plugins_grass/build/worker.js');
    const queue = [];
    worker.requestGenerate = (x, y) => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 3);
      worker.postMessage({
        type: 'chunk',
        x,
        y,
        buffer,
      }, [buffer]);
      queue.push(buffer => {
        accept(buffer);
      });
    });
    worker.requestTexture = () => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(TEXTURE_SIZE * TEXTURE_SIZE  * 4);
      worker.postMessage({
        type: 'texture',
        buffer,
      }, [buffer]);
      queue.push(buffer => {
        const canvas = document.createElement('canvas');
        canvas.width = TEXTURE_SIZE;
        canvas.height = TEXTURE_SIZE;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        imageData.data.set(new Uint8Array(buffer));
        ctx.putImageData(imageData, 0, 0);

        accept(canvas);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    worker.requestTexture()
      .then(textureImg => {
        if (live) {
          const texture = new THREE.Texture(
            textureImg,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            // THREE.LinearMipMapLinearFilter,
            // THREE.LinearMipMapLinearFilter,
            THREE.NearestMipMapLinearFilter,
            THREE.NearestMipMapLinearFilter,
            // THREE.NearestMipMapNearestFilter,
            // THREE.NearestMipMapNearestFilter,
            // THREE.LinearFilter,
            // THREE.LinearFilter,
            // THREE.NearestFilter,
            // THREE.NearestFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
            16
          );
          texture.needsUpdate = true;
          const grassMaterial = new THREE.MeshBasicMaterial({
            // color: 0x000000,
            // shininess: 0,
            // shading: THREE.FlatShading,
            // vertexColors: THREE.VertexColors,
            side: THREE.DoubleSide,
            map: texture,
            transparent: true,
            alphaTest: 0.5,
          });

          const _requestGrassGenerate = (x, y) => worker.requestGenerate(x, y)
            .then(grassChunkBuffer => protocolUtils.parseGrassGeometry(grassChunkBuffer));

          const _makeGrassChunkMesh = (grassChunkData, x, z) => {
            const {positions, uvs, indices, heightRange} = grassChunkData;

            const geometry = (() => {
              const geometry = new THREE.BufferGeometry();
              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
              geometry.setIndex(new THREE.BufferAttribute(indices, 1));
              const [minY, maxY] = heightRange;
              geometry.boundingSphere = new THREE.Sphere(
                new THREE.Vector3(
                  (x * NUM_CELLS) + (NUM_CELLS / 2),
                  (minY + maxY) / 2,
                  (z * NUM_CELLS) + (NUM_CELLS / 2)
                ),
                Math.max(Math.sqrt((NUM_CELLS / 2) * (NUM_CELLS / 2) * 3), (maxY - minY) / 2)
              );

              return geometry;
            })();
            const material = grassMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;

            mesh.destroy = () => {
              geometry.dispose();
            };

            return mesh;
          };

          const chunker = chnkr.makeChunker({
            resolution: 32,
            range: 2,
          });

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
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Grass;
