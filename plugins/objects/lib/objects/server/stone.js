const path = require('path');

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('../../constants/constants');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const stone = objectApi => {
  return () => jimp.read(path.join(__dirname, '../../img/stone.png'))
    .then(stoneImg => objectApi.registerTexture('stone', stoneImg))
    .then(() => {
      const stoneGeometry = (() => {
        const stoneUvs = objectApi.getUv('stone');
        const uvWidth = (stoneUvs[2] - stoneUvs[0]) * 0.25;
        const uvHeight = (stoneUvs[3] - stoneUvs[1]) * 0.25;

        const geometry = new THREE.BoxBufferGeometry(0.3, 0.2, 0.2)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.2/2, 0));
        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = stoneUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (stoneUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('stone', stoneGeometry);
      /* const stoneWallGeometry = (() => {
        const stoneUvs = objectApi.getUv('stone');
        const uvWidth = stoneUvs[2] - stoneUvs[0];
        const uvHeight = stoneUvs[3] - stoneUvs[1];

        const geometry = new THREE.BoxBufferGeometry(2, 1, 1);

        const positions = geometry.getAttribute('position').array;
        const numPositions = positions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          if (positions[i * 3 + 1] > 0) {
            positions[i * 3 + 0] *= 0.75;
            positions[i * 3 + 2] *= 0.75;
          }
        }
        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, 0));

        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = stoneUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (stoneUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('stone-wall', stoneWallGeometry);
      const stoneWall2Geometry = (() => {
        const stoneUvs = objectApi.getUv('stone');
        const uvWidth = stoneUvs[2] - stoneUvs[0];
        const uvHeight = stoneUvs[3] - stoneUvs[1];

        const geometry = new THREE.BoxBufferGeometry(2, 1, 1)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, 0));

        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = stoneUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (stoneUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('stone-wall-2', stoneWall2Geometry); */

      objectApi.registerGenerator('stone', chunk => {
        const localVector = new THREE.Vector3();
        const localQuaternion = new THREE.Quaternion();
        const localEuler = new THREE.Euler();

        const itemProbability = 0.25;

        for (let dz = 0; dz < NUM_CELLS; dz++) {
          for (let dx = 0; dx < NUM_CELLS; dx++) {
            const v = objectApi.getNoise('items', chunk.x, chunk.z, dx, dz);

            if (v < itemProbability && (objectApi.getHash(String(v)) % 2) === 0) {
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
                objectApi.addObject(chunk, 'stone', localVector, localQuaternion, 0);
              }
            }
          }
        }
      });

      return () => {
      };
    });
};

module.exports = stone;
