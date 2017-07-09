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
    const {three, render, pose, input, items, utils: {random: {chnkr}}} = zeo;
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

          class TrackedTree {
            constructor(mesh, box, startIndex, endIndex) {
              this.mesh = mesh;
              this.box = box;
              this.startIndex = startIndex;
              this.endIndex = endIndex;
            }
          }

          const trackedTrees = [];
          const _addTrackedTrees = (mesh, data) => {
            const {trees: treesData} = data;
            const numTrees = treesData.length / 3;
            const treeBaseWidth = 1.5; // XXX compute this accurately
            const treeBaseHeight = 2;
            let startTree = null;
            for (let i = 0; i < numTrees; i++) {
              const baseIndex = i * 5;
              const startIndex = treesData[baseIndex + 0];
              const endIndex = treesData[baseIndex + 1];
              const basePosition = new THREE.Vector3().fromArray(treesData, baseIndex + 2);
              const box = new THREE.Box3(
                basePosition.clone().add(new THREE.Vector3(-treeBaseWidth/2, 0, -treeBaseWidth/2)),
                basePosition.clone().add(new THREE.Vector3(treeBaseWidth/2, treeBaseHeight, treeBaseWidth/2))
              );
              const trackedTree = new TrackedTree(mesh, box, startIndex, endIndex);
              trackedTrees.push(trackedTree);

              if (startTree === null) {
                startTree = trackedTree;
              }
            }

            return [startTree, numTrees];
          };
          const _removeTrackedTrees = itemRange => {
            const [startTree, numTrees] = itemRange;
            trackedTrees.splice(trackedTrees.indexOf(startTree), numTrees);
          };
          const _getHoveredTrackedTree = side => {
            const {gamepads} = pose.getStatus();
            const gamepad = gamepads[side];
            const {worldPosition: controllerPosition} = gamepad;

            for (let i = 0; i < trackedTrees.length; i++) {
              const trackedTree = trackedTrees[i];
              if (trackedTree.box.containsPoint(controllerPosition)) {
                return trackedTree;
              }
            }
            return null;
          };

          const _gripdown = e => {
            const {side} = e;
            const trackedTree = _getHoveredTrackedTree(side);

            if (trackedTree) {
              const {mesh, startIndex, endIndex} = trackedTree;
              const {geometry} = mesh;
              const indexAttribute = geometry.index;
              const indices = indexAttribute.array;
              for (let i = startIndex; i < endIndex; i++) {
                indices[i] = 0;
              }
              indexAttribute.needsUpdate = true;

              const id = _makeId();
              const asset = 'WOOD';
              const {gamepads} = pose.getStatus();
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
              const assetInstance = items.makeItem({ // XXX clean up this API
                type: 'asset',
                id: id,
                name: asset,
                displayName: asset,
                attributes: {
                  position: {value: controllerPosition.toArray().concat(controllerRotation.toArray()).concat(controllerScale.toArray())},
                  asset: {value: asset},
                  quantity: {value: 1},
                  owner: {value: null},
                  bindOwner: {value: null},
                  physics: {value: false},
                },
              });
              assetInstance.grab(side);

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

                  const itemRange = _addTrackedTrees(treeChunkMesh, treeChunkData);

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
                  _removeTrackedTrees(itemRange);
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
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Tree;
