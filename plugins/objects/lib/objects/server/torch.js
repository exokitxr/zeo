const path = require('path');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const torch = objectApi => {
  return () => jimp.read(path.join(__dirname, '../../img/torch.png'))
    .then(torchImg => objectApi.registerTexture('torch', torchImg))
    .then(() => {
      const torchGeometry = (() => {
        const torchUvs = objectApi.getUv('torch');
        const subUvs = [6/16, 0/16, 10/16, 16/16];
        const torchSubUvs = _getSubUvs(torchUvs, subUvs);
        const uvWidth = torchSubUvs[2] - torchSubUvs[0];
        const uvHeight = torchSubUvs[3] - torchSubUvs[1];

        const geometry = new THREE.BoxBufferGeometry(0.05, 0.3, 0.05)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.1, 0));
        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = torchSubUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (torchSubUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        function _getSubUvs(a, b) {
          const uvWidthA = a[2] - a[0];
          const uvHeightA = a[3] - a[1];
          return [
            a[0] + (b[0] * uvWidthA),
            a[1] + (b[1] * uvHeightA),
            a[0] + (b[2] * uvWidthA),
            a[1] + (b[3] * uvHeightA),
          ];
        }

        return geometry;
      })();
      objectApi.registerGeometry('torch', torchGeometry);
      objectApi.registerLight('torch', 15);

      return () => {
      };
    });
};

module.exports = torch;
