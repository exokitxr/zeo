const path = require('path');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const apple = objectApi => {
  return () => jimp.read(path.join(__dirname, '../../img/apple.png'))
    .then(appleImg => objectApi.registerTexture('apple', appleImg))
    .then(() => {
      const appleGeometry = (() => {
        const appleUvs = objectApi.getUv('apple');
        const uvWidth = appleUvs[2] - appleUvs[0];
        const uvHeight = appleUvs[3] - appleUvs[1];

        const geometry = new THREE.BoxBufferGeometry(0.2, 0.2, 0.2)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.2/2, 0));

        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = appleUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (appleUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('apple', appleGeometry);

      return () => {
      };
    });
};

module.exports = apple;
