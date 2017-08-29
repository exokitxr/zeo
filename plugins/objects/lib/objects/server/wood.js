const path = require('path');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const wood = objectApi => {
  return () => jimp.read(path.join(__dirname, '../../img/wood.png'))
    .then(woodImg => objectApi.registerTexture('wood', woodImg))
    .then(() => {
      const woodWallGeometry = (() => {
        const woodUvs = objectApi.getUv('wood');
        const uvWidth = woodUvs[2] - woodUvs[0];
        const uvHeight = woodUvs[3] - woodUvs[1];

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
          uvs[i * 2 + 0] = woodUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (woodUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('wood-wall', woodWallGeometry);
      const woodWall2Geometry = (() => {
        const woodUvs = objectApi.getUv('wood');
        const uvWidth = woodUvs[2] - woodUvs[0];
        const uvHeight = woodUvs[3] - woodUvs[1];

        const geometry = new THREE.BoxBufferGeometry(2, 1, 0.75)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, 0));

        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = woodUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (woodUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('wood-wall-2', woodWall2Geometry);

      return () => {
      };
    });
};

module.exports = wood;
