const path = require('path');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const paper = objectApi => {
  return () => jimp.read(path.join(__dirname, '../../img/wood.png'))
    .then(paperImg => objectApi.registerTexture('paper', paperImg))
    .then(() => {
      const paperGeometry = (() => {
        const paperUvs = objectApi.getUv('paper');
        const uvWidth = paperUvs[2] - paperUvs[0];
        const uvHeight = paperUvs[3] - paperUvs[1];

        const PAPER_SIZE = 1;
        const STAND_SIZE = PAPER_SIZE * 2;
        const PAPER_BORDER_SIZE = PAPER_SIZE * 0.1;
        const width = PAPER_SIZE;
        const height = STAND_SIZE;
        const border = PAPER_BORDER_SIZE;
        const NUM_POSITIONS = 10 * 1024;

        const geometry = (() => {
          const leftGeometry = new THREE.BoxBufferGeometry(border, height, border)
            .applyMatrix(new THREE.Matrix4().makeTranslation(-(width / 2) - (border / 2), height/2 + border/2, -(border / 2)));

          const rightGeometry = new THREE.BoxBufferGeometry(border, height, border)
            .applyMatrix(new THREE.Matrix4().makeTranslation((width / 2) + (border / 2), height/2 + border/2, -(border / 2)));

          const bottomGeometry = new THREE.BoxBufferGeometry(width + (border * 2), border / 2, border * 2)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, height/2, border));

          const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
            for (let i = 0; i < src.length; i++) {
              dst[startIndexIndex + i] = src[i] + startAttributeIndex;
            }
          };

          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(NUM_POSITIONS);
          const normals = new Float32Array(NUM_POSITIONS);
          const uvs = new Float32Array(NUM_POSITIONS);
          const indices = new Uint16Array(NUM_POSITIONS);
          let attributeIndex = 0;
          let uvIndex = 0;
          let indexIndex = 0;
          [
            leftGeometry,
            rightGeometry,
            bottomGeometry,
          ].forEach(newGeometry => {
            const newPositions = newGeometry.getAttribute('position').array;
            positions.set(newPositions, attributeIndex);
            const newNormals = newGeometry.getAttribute('normal').array;
            normals.set(newNormals, attributeIndex);
            const newUvs = newGeometry.getAttribute('uv').array;
            uvs.set(newUvs, uvIndex);
            const newIndices = newGeometry.index.array;
            _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

            attributeIndex += newPositions.length;
            uvIndex += newUvs.length;
            indexIndex += newIndices.length;
          });
          geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
          geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals.buffer, normals.byteOffset, attributeIndex), 3));
          geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex), 2));
          geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices.buffer, indices.byteOffset, indexIndex), 1));
          return geometry;
        })();
        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = paperUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (paperUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('paper', paperGeometry);

      return () => {
      };
    });
};

module.exports = paper;
