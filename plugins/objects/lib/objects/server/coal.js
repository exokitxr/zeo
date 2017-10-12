const path = require('path');

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('../../constants/constants');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const coal = objectApi => {
  return () => jimp.read(path.join(__dirname, '../../img/wood.png'))
    .then(coalImg => objectApi.registerTexture('coal', coalImg))
    .then(() => {
      const coalGeometry = (() => {
        const coalUvs = objectApi.getUv('coal');
        const uvWidth = coalUvs[2] - coalUvs[0];
        const uvHeight = coalUvs[3] - coalUvs[1];

        const geometry = new THREE.OctahedronBufferGeometry(0.1, 0);
        const positions = geometry.getAttribute('position').array;
        const numPositions = positions.length / 3;
        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = coalUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (coalUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }
        const indices = new Uint32Array(numPositions);
        for (let i = 0; i < numPositions; i++) {
          indices[i] = i;
        }
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        return geometry;
      })();
      objectApi.registerGeometry('coal', coalGeometry);

      objectApi.registerGenerator('coal', chunk => {
        const localVector = new THREE.Vector3();
        const localQuaternion = new THREE.Quaternion();
        const localEuler = new THREE.Euler();

        const itemProbability = 0.16;

        for (let dz = 0; dz < NUM_CELLS; dz++) {
          for (let dx = 0; dx < NUM_CELLS; dx++) {
            const elevation = Math.floor(objectApi.getElevation(chunk.x * NUM_CELLS + dx, chunk.z * NUM_CELLS + dz));

            for (let dy = 0; dy <= elevation; dy++) {
              const v = objectApi.getNoise3D('minerals', chunk.x, chunk.z, dx, dy, dz);

              if (v < itemProbability && (objectApi.getHash(String(v)) % 2) === 1) {
                const ax = (chunk.x * NUM_CELLS) + dx;
                const az = (chunk.z * NUM_CELLS) + dz;
                localVector.set(ax, dy, az);
                localQuaternion.setFromEuler(localEuler.set(
                  0,
                  objectApi.getHash(String(v)) / 0xFFFFFFFF * Math.PI * 2,
                  0,
                  'YXZ'
                ));
                objectApi.addObject(chunk, 'coal', localVector, localQuaternion, 0);
              }
            }
          }
        }
      });

      return () => {
      };
    });
};

module.exports = coal;
