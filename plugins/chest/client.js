const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 100 * 1024;

class Chest {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose} = zeo;
    const {THREE, scene, camera} = three;

    const chestMaterial = new THREE.MeshBasicMaterial({
      // color: 0xFFFFFF,
      // shininess: 0,
      // shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      // side: THREE.DoubleSide,
    });

    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };

    const worker = new Worker('archae/plugins/_plugins_chest/build/worker.js');
    const queue = [];
    worker.requestGeometry = () => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 3 * 4);
      worker.postMessage({
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

    const _requestChestGeometry = () => worker.requestGeometry()
      .then(chestChunkBuffer => protocolUtils.parseChestChunks(chestChunkBuffer))
      .then(([chestGeometry, lidGeometry, latchGeometry, hingeGeometry]) => ({chestGeometry, lidGeometry, latchGeometry, hingeGeometry}));
    const _makeChestMesh = chestGeometries => {
      const {chestGeometry, lidGeometry, latchGeometry, hingeGeometry} = chestGeometries;

      const positions = new Float32Array(NUM_POSITIONS_CHUNK * 3);
      const colors = new Float32Array(NUM_POSITIONS_CHUNK * 3);
      const indices = new Uint32Array(NUM_POSITIONS_CHUNK * 3);
      let attributeIndex = 0;
      let indexIndex = 0;

      const _addGeometry = newGeometry => {
        const {positions: newPositions/*, normals*/, colors: newColors, indices: newIndices/*, heightRange*/} = newGeometry;

        positions.set(newPositions, attributeIndex);
        colors.set(newColors, attributeIndex);
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

        attributeIndex += newPositions.length;
        indexIndex += newIndices.length;
      };
      _addGeometry(chestGeometry);
      _addGeometry(lidGeometry);
      _addGeometry(latchGeometry);
      _addGeometry(hingeGeometry);

      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, attributeIndex), 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices.buffer, indices.byteOffset, indexIndex), 1));
      geometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(
          0,
          0,
          0
        ),
        10
      );

      const material = chestMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0, 31, 0);
      mesh.updateMatrixWorld();
      // mesh.frustumCulled = false;

      mesh.destroy = () => {
        geometry.dispose();
      };

      return mesh;
    };

    return _requestChestGeometry()
      .then(chestGeometries => {
        const chestMesh = _makeChestMesh(chestGeometries);
        scene.add(chestMesh);

        worker.terminate();

        const _update = () => {
          // XXX
        };
        render.on('update', _update);

        this._cleanup = () => {
          scene.remove(chestMesh);
          chestMesh.destroy();

          chestMaterial.dispose();

          render.removeListener('update', _update);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Chest;
