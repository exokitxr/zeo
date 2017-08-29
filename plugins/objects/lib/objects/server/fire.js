const path = require('path');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const fire = objectApi => {
  return () => jimp.read(path.join(__dirname, '../../img/fire.png'))
    .then(fireImg => objectApi.registerTexture('fire', fireImg))
    .then(() => {
      const fireGeometry = (() => {
        const fireUvs = objectApi.getUv('fire');
        const fireUvWidth = fireUvs[2] - fireUvs[0];
        const fireUvHeight = fireUvs[3] - fireUvs[1];

        const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, 0));
        const positions = geometry.getAttribute('position').array;
        const uvs = geometry.getAttribute('uv').array;

        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          if (
            i === 8 || i === 9 || i === 10 || i === 11 || // top
            i === 12 || i === 13 || i === 14 || i === 15 // bottom
          ) {
            uvs[i * 2 + 0] = 1;
            uvs[i * 2 + 1] = 0;
          } else {
            uvs[i * 2 + 0] = fireUvs[0] + (uvs[i * 2 + 0] * fireUvWidth);
            uvs[i * 2 + 1] = (fireUvs[1] + fireUvHeight) - (uvs[i * 2 + 1] * fireUvHeight);
          }
        }

        const numPositions = positions.length;
        const frames = new Float32Array(numPositions);
        for (let i = 0; i < numPositions; i++) {
          const baseIndex = i * 3;
          frames[baseIndex + 0] = fireUvs[1];
          frames[baseIndex + 1] = fireUvHeight / 8;
          frames[baseIndex + 2] = 8;
        }
        geometry.addAttribute('frame', new THREE.BufferAttribute(frames, 3));

        return geometry;
      })();
      objectApi.registerGeometry('fire', fireGeometry);

      return () => {
      };
    });
};

module.exports = fire;
