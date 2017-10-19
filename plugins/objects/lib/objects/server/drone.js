const path = require('path');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const drone = objectApi => {
  return () => jimp.read(path.join(__dirname, '../../img/plastic.png'))
    .then(droneImg => objectApi.registerTexture('drone', droneImg))
    .then(() => {
      const droneGeometry = (() => {
        const droneUvs = objectApi.getUv('drone');
        const uvWidth = droneUvs[2] - droneUvs[0];
        const uvHeight = droneUvs[3] - droneUvs[1];

        const geometry = new THREE.BoxBufferGeometry(2, 1, 0.1);
        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = droneUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (droneUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }
        return geometry;
      })();
      objectApi.registerGeometry('drone', droneGeometry);

      return () => {
      };
    });
};

module.exports = drone;
