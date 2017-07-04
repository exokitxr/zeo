const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 10 * 1024;

class Chest {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, input, hands, animation, utils: {geometry: geometryUtils}} = zeo;
    const {THREE, scene} = three;

    const zeroQuaternion = new THREE.Quaternion();
    const upQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0)
    );
    const animalMaterial = new THREE.MeshPhongMaterial({
      color: 0xFF0000,
      // shininess: 0,
      // shading: THREE.FlatShading,
      // vertexColors: THREE.VertexColors,
      // side: THREE.DoubleSide,
    });

    /* const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    }; */
    const _sum = a => {
      let result = 0;
      for (let i = 0; i < a.length; i++) {
        const e = a[i];
        result += e;
      }
      return result;
    };
    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };

    const worker = new Worker('archae/plugins/_plugins_animal/build/worker.js');
    const queue = [];
    worker.requestAnimalGeometry = () => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(NUM_POSITIONS * (3 + 3 + 2 + 1));
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

    const _requestAnimalGeometry = () => worker.requestAnimalGeometry()
      .then(animalBuffer => protocolUtils.parseGeometry(animalBuffer));
    const _makeAnimalMesh = animalGeometry => {
      const {positions, normals, uvs, indices} = animalGeometry;

      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      const material = animalMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(2, 31, 0);
      mesh.updateMatrixWorld();
      // mesh.frustumCulled = false;

      mesh.destroy = () => {
        geometry.dispose();
      };

      return mesh;
    };

    return _requestAnimalGeometry()
      .then(animalGeometry => {
        const animalMesh = _makeAnimalMesh(animalGeometry);
        scene.add(animalMesh);

        worker.terminate();

        this._cleanup = () => {
          scene.remove(animalMesh);
          animalMesh.destroy();

          animalMaterial.dispose();
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Chest;
