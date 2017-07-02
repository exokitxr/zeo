const chnkr = require('chnkr');

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
    const {three, render, pose} = zeo;
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
    };

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
          Math.max(Math.sqrt((NUM_CELLS / 2) * (NUM_CELLS / 2) * 2), (maxY - minY) / 2)
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

    const chunker = chnkr.makeChunker({
      resolution: 32,
      range: 2,
      useLods: false,
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

            chunk.data = treeChunkMesh;
          });
      });
      return Promise.all(addedPromises)
        .then(() => {
          removed.forEach(chunk => {
            const {data: treeChunkMesh} = chunk;
            scene.remove(treeChunkMesh);
            treeChunkMesh.destroy();
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

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tree;
