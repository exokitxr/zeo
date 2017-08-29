const path = require('path');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const NUM_POSITIONS = 10 * 1024;
const MONITOR_SIZE = 1;
const STAND_SIZE = 2;
const MONITOR_BORDER_SIZE = MONITOR_SIZE * 0.1;
const width = MONITOR_SIZE;
const aspectRatio = 1.5;
const height = width / aspectRatio;
const border = MONITOR_BORDER_SIZE;

const monitor = objectApi => {
  return () => jimp.read(path.join(__dirname, '../../img/plastic.png'))
    .then(monitorImg => objectApi.registerTexture('monitor', monitorImg))
    .then(() => {
      const monitorGeometry = (() => {
        const monitorUvs = objectApi.getUv('monitor');
        const uvWidth = monitorUvs[2] - monitorUvs[0];
        const uvHeight = monitorUvs[3] - monitorUvs[1];

        const geometry = (() => {
          const trunkGeometry = new THREE.BoxBufferGeometry(border, STAND_SIZE, border)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, STAND_SIZE/2 + border, 0));

          const screenGeometry = new THREE.BoxBufferGeometry(width, height, border)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, STAND_SIZE - height/2 + border, border/2 + border/2));

          const baseGeometry = new THREE.BoxBufferGeometry(border * 4, border, border * 3)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, border/2, 0));

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
            trunkGeometry,
            screenGeometry,
            baseGeometry,
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
          uvs[i * 2 + 0] = monitorUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (monitorUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('monitor', monitorGeometry);

      return () => {
      };
    });
};

module.exports = monitor;
