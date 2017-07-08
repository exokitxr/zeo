const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 200 * 1024;

class Items {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, input, utils: {random: {chnkr}}} = zeo;
    const {THREE, scene, camera} = three;

    const itemsMaterial = new THREE.MeshBasicMaterial({
      // color: 0xFFFFFF,
      // shininess: 0,
      // shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      // side: THREE.DoubleSide,
    });

    const worker = new Worker('archae/plugins/_plugins_items/build/worker.js');
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
    };
    const _requestItemsGenerate = (x, y) => worker.requestGenerate(x, y)
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
          Math.max(Math.sqrt((NUM_CELLS / 2) * (NUM_CELLS / 2) * 3), (maxY - minY) / 2)
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

    class Item {
      constructor(mesh, type, startIndex, endIndex, position) {
        this.mesh = mesh;
        this.type = type;
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        this.position = position;
      }
    }

    const items = [];
    const _addItems = (mesh, data) => {
      const {items: itemsData} = data;
      const numItems = itemsData.length / 4;
      let startItem = null;
      for (let i = 0; i < numItems; i++) {
        const baseIndex = i * 6;
        const type = itemsData[baseIndex + 0];
        const startIndex = itemsData[baseIndex + 1];
        const endIndex = itemsData[baseIndex + 2];
        const position = new THREE.Vector3().fromArray(itemsData, baseIndex + 3);
        const item = new Item(mesh, type, startIndex, endIndex, position);
        items.push(item);

        if (startItem === null) {
          startItem = item;
        }
      }

      return [startItem, numItems];
    };
    const _removeItems = itemRange => {
      const [startItem, numItems] = itemRange;
      const index = items.indexOf(startItem);
      items.splice(index, numItems);
    };
    const _getHoveredItem = side => {
      const {gamepads} = pose.getStatus();
      const gamepad = gamepads[side];
      const {worldPosition: controllerPosition} = gamepad;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (controllerPosition.distanceTo(item.position) < 0.2) {
          return item;
        }
      }
      return null;
    };

    const _gripdown = e => {
      const {side} = e;
      const hoveredItem = _getHoveredItem(side);

      if (hoveredItem) {
        const {mesh, startIndex, endIndex} = hoveredItem;
        const {geometry} = mesh;
        const indexAttribute = geometry.index;
        const indices = indexAttribute.array;
        for (let i = startIndex; i < endIndex; i++) {
          indices[i] = 0;
        }
        indexAttribute.needsUpdate = true;

        // XXX generate and grab the asset here
      }
    };
    input.on('gripdown', _gripdown);

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

        return _requestItemsGenerate(x, z)
          .then(itemsChunkData => {
            const itemsChunkMesh = _makeItemsChunkMesh(itemsChunkData, x, z);
            scene.add(itemsChunkMesh);

            const itemRange = _addItems(itemsChunkMesh, itemsChunkData);

            chunk.data = {
              itemsChunkMesh,
              itemRange,
            };
          });
      });
      return Promise.all(addedPromises)
        .then(() => {
          removed.forEach(chunk => {
            const {data} = chunk;
            const {itemsChunkMesh} = data;
            scene.remove(itemsChunkMesh);
            itemsChunkMesh.destroy();

            const {itemRange} = data;
            _removeItems(itemRange);
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
      // XXX remove old items meshes here

      itemsMaterial.dispose();

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Items;
