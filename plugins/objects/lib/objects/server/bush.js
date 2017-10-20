const path = require('path');

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('../../constants/constants');
const NUM_POSITIONS_CHUNK = 200 * 1024;
const TEXTURE_SIZE = 512;

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const bush = objectApi => {
  const upVector = new THREE.Vector3(0, 1, 0);

  const rng = (() => {
    let i = 0;
    return () => objectApi.getHash('bush:' + i++) / 0xFFFFFFFF;
  })();

  const _requestBushImg = () => jimp.read(path.join(__dirname, '..', '..', 'img', 'bush.png'));

  return () => _requestBushImg()
    .then(img => objectApi.registerTexture('bush', img))
    .then(() => {
      const bushUvs = objectApi.getUv('bush');
      const newStemUvs = [
        bushUvs[0], bushUvs[1] + (bushUvs[3] - bushUvs[1]) * 3/4,
        bushUvs[2], bushUvs[3],
      ];
      const stemUvWidth = newStemUvs[2] - newStemUvs[0];
      const stemUvHeight = newStemUvs[3] - newStemUvs[1];
      const newLeafUvs = [
        bushUvs[0], bushUvs[1],
        bushUvs[2], bushUvs[1] + (bushUvs[3] - bushUvs[1]) * 3/4,
      ];
      const leafUvWidth = newLeafUvs[2] - newLeafUvs[0];
      const leafUvHeight = newLeafUvs[3] - newLeafUvs[1];

      const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
        for (let i = 0; i < src.length; i++) {
          dst[startIndexIndex + i] = src[i] + startAttributeIndex;
        }
      };
      const doublePlaneBufferGeometry = (() => {
        const planeBufferGeometry = new THREE.PlaneBufferGeometry(1, 1);
        const oldPositions = planeBufferGeometry.getAttribute('position').array;
        // const oldNormals = planeBufferGeometry.getAttribute('normal').array;
        const oldUvs = planeBufferGeometry.getAttribute('uv').array;
        const oldIndices = planeBufferGeometry.index.array;

        const positions = new Float32Array(oldPositions.length * 2);
        // const normals = new Float32Array(oldNormals.length * 2);
        const uvs = new Float32Array(oldUvs.length * 2);
        const indices = new Uint32Array(oldIndices.length * 2);

        const numPositions = positions.length / 3;
        const numOldPositions = oldPositions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          const srcI = i % numOldPositions;
          positions[i * 3 + 0] = oldPositions[srcI * 3 + 0];
          positions[i * 3 + 1] = oldPositions[srcI * 3 + 1];
          positions[i * 3 + 2] = oldPositions[srcI * 3 + 2];

          /* normals[i * 3 + 0] = oldNormals[srcI * 3 + 0];
          normals[i * 3 + 1] = oldNormals[srcI * 3 + 1];
          normals[i * 3 + 2] = oldNormals[srcI * 3 + 2]; */

          uvs[i * 2 + 0] = oldUvs[srcI * 2 + 0];
          uvs[i * 2 + 1] = oldUvs[srcI * 2 + 1];
        }

        const numIndices = indices.length / 3;
        const numOldIndices = oldIndices.length / 3;
        for (let i = 0; i < numOldIndices; i++) {
          const srcI = i;
          indices[i * 3 + 0] = oldIndices[srcI * 3 + 0];
          indices[i * 3 + 1] = oldIndices[srcI * 3 + 1];
          indices[i * 3 + 2] = oldIndices[srcI * 3 + 2];
        }
        for (let i = numOldIndices; i < numIndices; i++) {
          const srcI = i - numOldIndices;
          indices[i * 3 + 0] = oldIndices[srcI * 3 + 0];
          indices[i * 3 + 1] = oldIndices[srcI * 3 + 2];
          indices[i * 3 + 2] = oldIndices[srcI * 3 + 1];
        }

        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        // geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        return geometry;
      })();
      const bushTemplate = (() => {
        const positions = new Float32Array(NUM_POSITIONS_CHUNK);
        const uvs = new Float32Array(NUM_POSITIONS_CHUNK);
        const indices = new Uint32Array(NUM_POSITIONS_CHUNK);
        let attributeIndex = 0;
        let uvIndex = 0;
        let indexIndex = 0;

        const stemGeometry = doublePlaneBufferGeometry.clone()
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, 0))
          .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            -Math.PI / 2 * 1/8
          )));

        const stemUvs = stemGeometry.getAttribute('uv').array;
        for (let j = 0; j < stemUvs.length / 2; j++) {
          const baseIndex = j * 2;
          stemUvs[baseIndex + 0] = newStemUvs[0] + stemUvs[baseIndex + 0] * stemUvWidth;
          stemUvs[baseIndex + 1] = newStemUvs[1] + (1 - stemUvs[baseIndex + 1]) * stemUvHeight;
        }

        const leafGeometry = doublePlaneBufferGeometry.clone()
          .applyMatrix(new THREE.Matrix4().makeScale(1, 2, 1))
          .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            -Math.PI / 2
          )))
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -2/2))
          .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            -Math.PI / 2 * 1/8
          )))
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.9807852506637573, -0.19509032368659973));
        const leafUvs = leafGeometry.getAttribute('uv').array;
        for (let j = 0; j < leafUvs.length / 2; j++) {
          const baseIndex = j * 2;
          leafUvs[baseIndex + 0] = newLeafUvs[0] + leafUvs[baseIndex + 0] * leafUvWidth;
          leafUvs[baseIndex + 1] = newLeafUvs[1] + (1 - leafUvs[baseIndex + 1]) * leafUvHeight;
        }

        for (let i = 0; i < 4; i++) {
          const newStemGeometry = stemGeometry.clone()
            .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(
              upVector,
              i / 4 * Math.PI * 2
            )));
          const newStemPositions = newStemGeometry.getAttribute('position').array;
          positions.set(newStemPositions, attributeIndex);
          const newStemUvs = newStemGeometry.getAttribute('uv').array;
          uvs.set(newStemUvs, uvIndex);
          const newStemIndices = newStemGeometry.index.array;
          _copyIndices(newStemIndices, indices, indexIndex, attributeIndex / 3);
          attributeIndex += newStemPositions.length;
          uvIndex += newStemUvs.length;
          indexIndex += newStemIndices.length;

          const newLeafGeometry = leafGeometry.clone()
            .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(
              upVector,
              i / 4 * Math.PI * 2
            )));
          const newLeafPositions = newLeafGeometry.getAttribute('position').array;
          positions.set(newLeafPositions, attributeIndex);
          const newLeafUvs = newLeafGeometry.getAttribute('uv').array;
          uvs.set(newLeafUvs, uvIndex);
          const newLeafIndices = newLeafGeometry.index.array;
          _copyIndices(newLeafIndices, indices, indexIndex, attributeIndex / 3);
          attributeIndex += newLeafPositions.length;
          uvIndex += newLeafUvs.length;
          indexIndex += newLeafIndices.length;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
        geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex), 2));
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices.buffer, indices.byteOffset, indexIndex), 1));
        geometry.applyMatrix(new THREE.Matrix4().makeScale(0.75, 0.75, 0.75));

        return geometry;
      })();
      objectApi.registerGeometry('bush', bushTemplate);

      const localVector = new THREE.Vector3();
      const localQuaternion = new THREE.Quaternion();

      const bushProbability = 0.3;
      objectApi.registerGenerator('bush', chunk => {
        const aox = chunk.x * NUM_CELLS;
        const aoz = chunk.z * NUM_CELLS;

        for (let dz = 0; dz < NUM_CELLS_OVERSCAN; dz++) {
          for (let dx = 0; dx < NUM_CELLS_OVERSCAN; dx++) {
            const ax = aox + dx;
            const az = aoz + dz;
            const v = objectApi.getNoise('bush', 0, 0, ax + 1000, az + 1000);

            if (v < bushProbability) {
              const elevation = objectApi.getElevation(ax, az);

              if (elevation > 64) {
                localVector.set(
                  ax,
                  elevation,
                  az
                );
                localQuaternion.setFromAxisAngle(upVector, objectApi.getHash(v + ':angle') / 0xFFFFFFFF * Math.PI * 2);

                objectApi.addVegetation(chunk, 'bush', localVector, localQuaternion);
              }
            }
          }
        }
      });

      return () => {
      };
    });
};

module.exports = bush;
