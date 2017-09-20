const path = require('path');

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('../../constants/constants');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const stick = objectApi => {
  return () => jimp.read(path.join(__dirname, '../../img/wood.png'))
    .then(stickImg => objectApi.registerTexture('stick', stickImg))
    .then(() => {
      const stickGeometry = (() => {
        const stickUvs = objectApi.getUv('stick');
        const uvWidth = stickUvs[2] - stickUvs[0];
        const uvHeight = stickUvs[3] - stickUvs[1];

        const width = 0.5;
        const geometry = new THREE.BoxBufferGeometry(width, 0.05, 0.05, 4, 1, 1)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.05/2, 0));
        const positions = geometry.getAttribute('position').array;
        const numPositions = positions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          const x = positions[i * 3 + 0];
          if (x === 0) {
            positions[i * 3 + 2] += 0.05;
          }
        }
        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = stickUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (stickUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('stick', stickGeometry);

      objectApi.registerGenerator('stick', chunk => {
        const localVector = new THREE.Vector3();
        const localQuaternion = new THREE.Quaternion();
        const localEuler = new THREE.Euler();

        const itemProbability = 0.25;

        for (let dz = 0; dz < NUM_CELLS; dz++) {
          for (let dx = 0; dx < NUM_CELLS; dx++) {
            const v = objectApi.getNoise('items', chunk.x, chunk.z, dx, dz);

            if (v < itemProbability && (objectApi.getHash(String(v)) % 2) === 1) {
              const elevation = Math.floor(objectApi.getElevation(chunk.x * NUM_CELLS + dx, chunk.z * NUM_CELLS + dz));

              if (elevation > 64) {
                const ax = (chunk.x * NUM_CELLS) + dx;
                const az = (chunk.z * NUM_CELLS) + dz;
                localVector.set(ax, elevation, az);
                localQuaternion.setFromEuler(localEuler.set(
                  0,
                  objectApi.getHash(String(v)) / 0xFFFFFFFF * Math.PI * 2,
                  0,
                  'YXZ'
                ));
                objectApi.addObject(chunk, 'stick', localVector, localQuaternion, 0);
              }
            }
          }
        }
      });

      return () => {
      };
    });
};

module.exports = stick;
