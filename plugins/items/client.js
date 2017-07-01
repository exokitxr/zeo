const chnkr = require('chnkr');

const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 2000 * 1000;

class Items {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose} = zeo;
    const {THREE, scene, camera} = three;

    const itemsMaterial = new THREE.MeshBasicMaterial({
      // color: 0xFFFFFF,
      // shininess: 0,
      // shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      // side: THREE.DoubleSide,
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
    const _requestItemsGenerate = (x, y) => fetch(`archae/items/generate?x=${x}&y=${y}`)
      .then(_resArrayBuffer)
      .then(itemsChunkBuffer => protocolUtils.parseItemsChunk(itemsChunkBuffer));

    const _makeItemsChunkMesh = (mapChunkData, x, z) => {
      const {positions, normals, colors, indices, heightRange} = mapChunkData;

      const geometry = (() => {
        let geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        // geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
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
      const material = itemsMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      // mesh.frustumCulled = false;

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

    const _requestRefreshGrassChunks = () => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

      const addedPromises = added.map(chunk => {
        const {x, z} = chunk;

        return _requestItemsGenerate(x, z)
          .then(itemsChunkData => {
            const itemsChunkMesh = _makeItemsChunkMesh(itemsChunkData, x, z);
            scene.add(itemsChunkMesh);

            chunk.data = itemsChunkMesh;
          });
      });
      return Promise.all(addedPromises)
        .then(() => {
          removed.forEach(chunk => {
            const {data: itemsChunkMesh} = chunk;
            scene.remove(itemsChunkMesh);
            itemsChunkMesh.destroy();
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
          // XXX remove old items meshes here

          itemsMaterial.dispose();

          render.removeListener('update', _update);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Items;
