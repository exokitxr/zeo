const sfxr = require('sfxr');
const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 200 * 1024;

class Tree {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, input, utils: {random: {chnkr}}} = zeo;
    const {THREE, scene, camera} = three;

    const upVector = new THREE.Vector3(0, 1, 0);
    const sideQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(1, 0, 0)
    );

    const treeMaterial = new THREE.MeshBasicMaterial({
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

    const _requestWorker = () => {
      const worker = new Worker('archae/plugins/_plugins_tree/build/worker.js');
      const queue = [];
      worker.requestGenerate = (x, y) => new Promise((accept, reject) => {
        const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 3);
        worker.postMessage({
          x,
          y,
          buffer,
        }, [buffer]);
        queue.push(buffer => {
          accept(buffer);
        });
      });
      worker.onmessage = e => {
        const {data: buffer} = e;
        const cb = queue.shift();
        cb(buffer);
      }

      return Promise.resolve(worker);
    };

    return Promise.all([
      _requestWorker(),
      sfxr.requestSfx('archae/tree/sfx/chop.ogg'),
    ])
      .then(([
        worker,
        chopSfx,
      ]) => {
        if (live) {

          const _requestTreeGenerate = (x, y) => worker.requestGenerate(x, y)
            .then(treeChunkBuffer => protocolUtils.parseTreeGeometry(treeChunkBuffer));

          const _makeTreeChunkMesh = (treeChunkData, x, z) => {
            const {position, positions, /*normals, */colors, indices, heightRange} = treeChunkData;

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
                Math.max(Math.sqrt((NUM_CELLS / 2) * (NUM_CELLS / 2) * 3), (maxY - minY) / 2)
              );

              // geometry.computeBoundingSphere();

              return geometry;
            })();
            const material = treeMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            // mesh.frustumCulled = false;

            mesh.destroy = () => {
              geometry.dispose();
            };

            return mesh;
          };

          const items = [];
          const _addItems = treeChunkData => {
            const {trees: treesData} = treeChunkData;
            const numTrees = treesData.length / 3;
            let startTree = null;
            for (let i = 0; i < numTrees; i++) {
              const v = new THREE.Vector3().fromArray(treesData, i * 3);
              const b = new THREE.Box3(
                v.clone().add(new THREE.Vector3(-0.5, 0, -0.5)),
                v.clone().add(new THREE.Vector3(0.5, 2, 0.5))
              );
              items.push(b);

              if (startTree === null) {
                startTree = b;
              }
            }

            return [startTree, numTrees];
          };
          const _removeItems = itemRange => {
            const [startTree, numTrees] = itemRange;
            const index = items.findIndex(startTree);
            items.splice(index, numTrees);
          };
          const _getHoveredItem = side => {
            const {gamepads} = pose.getStatus();
            const gamepad = gamepads[side];
            const {worldPosition: controllerPosition} = gamepad;

            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item.containsPoint(controllerPosition)) {
                return item;
              }
            }
            return null;
          };

          const _gripdown = e => {
            const {side} = e;
            const hoveredItem = _getHoveredItem(side);

            if (hoveredItem !== null) {
              chopSfx.trigger();
            }
          };
          input.on('gripdown', _gripdown);

          const chunker = chnkr.makeChunker({
            resolution: 32,
            range: 2,
          });

          const _requestRefreshTreeChunks = () => {
            const {hmd} = pose.getStatus();
            const {worldPosition: hmdPosition} = hmd;
            const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

            const addedPromises = added.map(chunk => {
              const {x, z} = chunk;

              return _requestTreeGenerate(x, z)
                .then(treeChunkData => {
                  const treeChunkMesh = _makeTreeChunkMesh(treeChunkData, x, z);
                  scene.add(treeChunkMesh);

                  const itemRange = _addItems(treeChunkData);

                  chunk.data = {
                    treeChunkMesh,
                    itemRange,
                  };
                });
            });
            return Promise.all(addedPromises)
              .then(() => {
                removed.forEach(chunk => {
                  const {data} = chunk;
                  const {treeChunkMesh} = data;
                  scene.remove(treeChunkMesh);
                  treeChunkMesh.destroy();

                  const {itemRange} = data;
                   _removeItems(itemRange);
                });
              })
          };

          let updating = false;
          let updateQueued = false;
          const tryTreeChunkUpdate = () => {
            if (!updating) {
              updating = true;

              const done = () => {
                updating = false;

                if (updateQueued) {
                  updateQueued = false;

                  tryTreeChunkUpdate();
                }
              };

              _requestRefreshTreeChunks()
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
            tryTreeChunkUpdate();
          };
          render.on('update', _update);

          this._cleanup = () => {
            // XXX remove old tree meshes here

            treeMaterial.dispose();

            input.removeListener('gripdown', _gripdown);
            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tree;
