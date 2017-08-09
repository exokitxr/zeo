const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const grass = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene} = three;

  const localVector = new THREE.Vector3();

  const _requestImage = src => new Promise((accept, reject) => {
    const img = new Image();
    img.onload = () => {
      accept(img);
    };
    img.onerror = err => {
      reject(img);
    };
    img.src = src;
  });

  return () => _requestImage('/archae/objects/img/grass.png')
    .then(grassImg => objectApi.registerTexture('grass', grassImg))
    .then(() => objectApi.registerGeometry('grass', (args) => {
      const {THREE, getUv, rng} = args;
      const grassUvs = getUv('grass');
      const uvWidth = grassUvs[2] - grassUvs[0];
      const uvHeight = grassUvs[3] - grassUvs[1];

      const NUM_POSITIONS = 20 * 1024;
      const zeroVector = new THREE.Vector3();
      const upVector = new THREE.Vector3(0, 1, 0);

      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3(1, 1, 1);
      const matrix = new THREE.Matrix4();

      const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
        for (let i = 0; i < src.length; i++) {
          dst[startIndexIndex + i] = src[i] + startAttributeIndex;
        }
      };

      const positions = new Float32Array(NUM_POSITIONS * 3);
      const uvs = new Float32Array(NUM_POSITIONS * 2);
      const indices = new Uint32Array(NUM_POSITIONS);
      let attributeIndex = 0;
      let uvIndex = 0;
      let indexIndex = 0;

      const numGrasses = Math.floor(5 + rng() * 5);
      for (let i = 0; i < numGrasses; i++) {
        position.set(-0.5 + rng(), 0, -0.5 + rng())
          .normalize()
          .multiplyScalar(rng() * 2)
          .add(new THREE.Vector3(0, 0.5, 0));
        quaternion.setFromAxisAngle(upVector, rng() * Math.PI * 2);
        // scale.set(5 + (rng() * 5), 5 + rng() * 10, 5 + (rng() * 5));
        matrix.compose(position, quaternion, scale);

        const geometry = new THREE.PlaneBufferGeometry(1, 1)
          .applyMatrix(matrix);
        const newPositions = geometry.getAttribute('position').array;
        positions.set(newPositions, attributeIndex);
        const newUvs = geometry.getAttribute('uv').array;
        const numNewUvs = newUvs.length / 2;
        for (let j = 0; j < numNewUvs; j++) {
          const baseIndex = j * 2;
          newUvs[baseIndex + 0] = grassUvs[0] + (newUvs[baseIndex + 0] * uvWidth);
          newUvs[baseIndex + 1] = (grassUvs[1] + uvHeight) - (newUvs[baseIndex + 1] * uvHeight);
        }
        uvs.set(newUvs, uvIndex);
        const newIndices = geometry.index.array;
        _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

        attributeIndex += newPositions.length;
        uvIndex += newUvs.length;
        indexIndex += newIndices.length;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
      geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex), 2));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices.buffer, indices.byteOffset, indexIndex), 1));
      geometry.boundingBox = new THREE.Box3(zeroVector, zeroVector);

      return geometry;
    }))
    .then(() => {
      return () => {
        // XXX
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = grass;
