const path = require('path');

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('../../constants/constants');
const {
  parseBlueprint,
}= require('../../utils/block-utils.js');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const NUM_POSITIONS = 10 * 1024;

const HOUSE_SPEC = parseBlueprint(`\
c=stone|s=stone-stairs|j=oak-wood-planks|H=ladder|G=glass-top|g=glass-west|l=glass-east|!=torch|w=oak-wood|1=fence-nw|2=fence-ne|3=fence-sw|4=fence-se|a=fence-top|b=fence-side
|----Layer 1|
ccccc
ccccc
ccccc
ccccc
ccccc
  s  
|----Layer 2|
cjjjc
j  Hj
j   j
j   j
cj jc
     
|----Layer 3|
cjGjc
j  Hj
g   l
j   j
cj jc
     
|----Layer 4|
cjjjc
j  Hj
j   j
j ! j
cjjjc
     
|----Layer 5|
wwwww
wjjHw
wjjjw
wjjjw
wwwww
     
|----Layer 6 (optional)|
1aaa2
b   b
b   b
b   b
3aaa4
     
`);

const house = objectApi => {
  return () => Promise.all([
    jimp.read(path.join(__dirname, '../../img/wood.png'))
      .then(houseWoodImg => objectApi.registerTexture('house-wood', houseWoodImg, {fourTap: true})),
    jimp.read(path.join(__dirname, '../../img/tree-top.png'))
      .then(houseWoodTopImg => objectApi.registerTexture('house-wood-top', houseWoodTopImg, {fourTap: true})),
    jimp.read(path.join(__dirname, '../../img/stone.png'))
      .then(houseStoneImg => objectApi.registerTexture('house-stone', houseStoneImg, {fourTap: true})),
    jimp.read(path.join(__dirname, '../../img/plank.png'))
      .then(housePlankImg => objectApi.registerTexture('house-plank', housePlankImg, {fourTap: true})),
    jimp.read(path.join(__dirname, '../../img/plank.png'))
      .then(fenceImg => objectApi.registerTexture('fence', fenceImg)),
    jimp.read(path.join(__dirname, '../../img/ladder.png'))
      .then(ladderImg => objectApi.registerTexture('ladder', ladderImg)),
    jimp.read(path.join(__dirname, '../../img/glass.png'))
      .then(glassImg => objectApi.registerTexture('glass', glassImg)),
  ])
    .then(() => {
      const _applyUvs = (geometry, x, y, w, h) => {
        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = x + (uvs[i * 2 + 0] * w);
          uvs[i * 2 + 1] = (y + h) - (uvs[i * 2 + 1] * h);
        }
      };
      const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
        for (let i = 0; i < src.length; i++) {
          dst[startIndexIndex + i] = src[i] + startAttributeIndex;
        }
      };

      const houseWoodUvs = objectApi.getTileUv('house-wood');
      const houseWoodTopUvs = objectApi.getTileUv('house-wood-top');
      const houseWoodBlock = {
        uvs: [
          houseWoodUvs,
          houseWoodUvs,
          houseWoodTopUvs,
          houseWoodTopUvs,
          houseWoodUvs,
          houseWoodUvs,
        ],
        transparent: false,
        translucent: false,
      };
      objectApi.registerBlock('house-wood', houseWoodBlock);

      const houseStoneUvs = objectApi.getTileUv('house-stone');
      const houseStoneBlock = {
        uvs: [
          houseStoneUvs,
          houseStoneUvs,
          houseStoneUvs,
          houseStoneUvs,
          houseStoneUvs,
          houseStoneUvs,
        ],
        transparent: false,
        translucent: false,
      };
      objectApi.registerBlock('house-stone', houseStoneBlock);

      const housePlankUvs = objectApi.getTileUv('house-plank');
      const housePlankBlock = {
        uvs: [
          housePlankUvs,
          housePlankUvs,
          housePlankUvs,
          housePlankUvs,
          housePlankUvs,
          housePlankUvs,
        ],
        transparent: false,
        translucent: false,
      };
      objectApi.registerBlock('house-plank', housePlankBlock);

      const stoneStairsGeometry = (() => {
        const woodUvs = objectApi.getUv('house-stone');
        const uvWidth = (woodUvs[2] - woodUvs[0]) / 2;
        const uvHeight = (woodUvs[3] - woodUvs[1]) / 2;

        const geometry = (() => {
          const frontGeometry = new THREE.BoxBufferGeometry(1, 1/4, 1)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, -1/2 + 1/4/2, 0));

          const middleGeometry = new THREE.BoxBufferGeometry(1, 1/4, 2/3)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, -1/2 + 1/4/2 + 1/4, -1/3/2));

          const backGeometry = new THREE.BoxBufferGeometry(1, 1/4, 1/3)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, -1/2 + 1/4/2 + 2/4, -2/3/2));

          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(NUM_POSITIONS);
          const normals = new Float32Array(NUM_POSITIONS);
          const uvs = new Float32Array(NUM_POSITIONS);
          const indices = new Uint16Array(NUM_POSITIONS);
          let attributeIndex = 0;
          let uvIndex = 0;
          let indexIndex = 0;
          [
            frontGeometry,
            middleGeometry,
            backGeometry,
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
          uvs[i * 2 + 0] = woodUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (woodUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('stone-stairs', stoneStairsGeometry);

      const fenceTopGeometry = (() => {
        const woodUvs = objectApi.getUv('fence');

        const leftGeometry = new THREE.BoxBufferGeometry(1/8, 1/2+0.075, 1/8)
          .applyMatrix(new THREE.Matrix4().makeTranslation(-1/4, -1/2 + (1/2+0.075)/2, 0));
        _applyUvs(leftGeometry, woodUvs[0], woodUvs[1], (woodUvs[2] - woodUvs[0]) * 4 / 16, woodUvs[3] - woodUvs[1]);

        const rightGeometry = new THREE.BoxBufferGeometry(1/8, 1/2+0.075, 1/8)
          .applyMatrix(new THREE.Matrix4().makeTranslation(1/4, -1/2 + (1/2+0.075)/2, 0));
        _applyUvs(rightGeometry, woodUvs[0], woodUvs[1], (woodUvs[2] - woodUvs[0]) * 4 / 16, woodUvs[3] - woodUvs[1]);

        const topGeometry = new THREE.BoxBufferGeometry(1, 1/16, 1/16)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, -1/2 + 1/2, 0));
        _applyUvs(topGeometry, woodUvs[0], woodUvs[1], woodUvs[2] - woodUvs[0], (woodUvs[3] - woodUvs[1]) * 2 / 16);

        const bottomGeometry = new THREE.BoxBufferGeometry(1, 1/16, 1/16)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, -1/2 + 1/4, 0));
        _applyUvs(bottomGeometry, woodUvs[0], woodUvs[1], woodUvs[2] - woodUvs[0], (woodUvs[3] - woodUvs[1]) * 2 / 16);

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
          topGeometry,
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
      objectApi.registerGeometry('fence-top', fenceTopGeometry);

      const fenceNwGeometry = (() => {
        const woodUvs = objectApi.getUv('fence');

        const centerGeometry = new THREE.BoxBufferGeometry(1/8, 1/2+0.075, 1/8)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, -1/2 + (1/2+0.075)/2, 0));
        _applyUvs(centerGeometry, woodUvs[0], woodUvs[1], (woodUvs[2] - woodUvs[0]) * 4 / 16, woodUvs[3] - woodUvs[1]);

        const bottom1Geometry = new THREE.BoxBufferGeometry(1/16, 1/16, 1/2)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, -1/2 + 1/2, 1/2/2));
        _applyUvs(bottom1Geometry, woodUvs[0], woodUvs[1], woodUvs[2] - woodUvs[0], (woodUvs[3] - woodUvs[1]) * 2 / 16);

        const bottom2Geometry = new THREE.BoxBufferGeometry(1/16, 1/16, 1/2)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, -1/2 + 1/4, 1/2/2));
        _applyUvs(bottom2Geometry, woodUvs[0], woodUvs[1], woodUvs[2] - woodUvs[0], (woodUvs[3] - woodUvs[1]) * 2 / 16);

        const right1Geometry = new THREE.BoxBufferGeometry(1/2, 1/16, 1/16)
          .applyMatrix(new THREE.Matrix4().makeTranslation(1/2/2, -1/2 + 1/2, 0));
        _applyUvs(right1Geometry, woodUvs[0], woodUvs[1], woodUvs[2] - woodUvs[0], (woodUvs[3] - woodUvs[1]) * 2 / 16);

        const right2Geometry = new THREE.BoxBufferGeometry(1/2, 1/16, 1/16)
          .applyMatrix(new THREE.Matrix4().makeTranslation(1/2/2, -1/2 + 1/4, 0));
        _applyUvs(right2Geometry, woodUvs[0], woodUvs[1], woodUvs[2] - woodUvs[0], (woodUvs[3] - woodUvs[1]) * 2 / 16);

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(NUM_POSITIONS);
        const normals = new Float32Array(NUM_POSITIONS);
        const uvs = new Float32Array(NUM_POSITIONS);
        const indices = new Uint16Array(NUM_POSITIONS);
        let attributeIndex = 0;
        let uvIndex = 0;
        let indexIndex = 0;
        [
          centerGeometry,
          bottom1Geometry,
          bottom2Geometry,
          right1Geometry,
          right2Geometry,
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
      objectApi.registerGeometry('fence-nw', fenceNwGeometry);

      const ladderGeometry = (() => {
        const woodUvs = objectApi.getUv('ladder');
        const uvWidth = woodUvs[2] - woodUvs[0];
        const uvHeight = woodUvs[3] - woodUvs[1];

        const backGeometry = (() => {
          const geometry = new THREE.PlaneBufferGeometry(1, 1, 1)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -1/2 + 0.05));

          const uvs = geometry.getAttribute('uv').array;
          const numUvs = uvs.length / 2;
          for (let i = 0; i < numUvs; i++) {
            uvs[i * 2 + 0] = woodUvs[0] + (uvs[i * 2 + 0] * uvWidth);
            uvs[i * 2 + 1] = (woodUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
          }

          return geometry;
        })();
        const frontGeometry = (() => {
          const geometry = new THREE.PlaneBufferGeometry(1, 1, 1)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 1/2));

          const uvs = geometry.getAttribute('uv').array;
          uvs.fill(1);

          return geometry;
        })();

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(NUM_POSITIONS);
        const normals = new Float32Array(NUM_POSITIONS);
        const uvs = new Float32Array(NUM_POSITIONS);
        const indices = new Uint16Array(NUM_POSITIONS);
        let attributeIndex = 0;
        let uvIndex = 0;
        let indexIndex = 0;
        [
          backGeometry,
          frontGeometry,
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
      objectApi.registerGeometry('ladder', ladderGeometry);

      const glassGeometry = (() => {
        const woodUvs = objectApi.getUv('glass');
        const uvWidth = woodUvs[2] - woodUvs[0];
        const uvHeight = woodUvs[3] - woodUvs[1];

        const backGeometry = (() => {
          const geometry = new THREE.PlaneBufferGeometry(1, 1, 1)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -1/2 + 0.05));

          const uvs = geometry.getAttribute('uv').array;
          const numUvs = uvs.length / 2;
          for (let i = 0; i < numUvs; i++) {
            uvs[i * 2 + 0] = woodUvs[0] + (uvs[i * 2 + 0] * uvWidth);
            uvs[i * 2 + 1] = (woodUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
          }

          return geometry;
        })();
        const frontGeometry = (() => {
          const geometry = new THREE.PlaneBufferGeometry(1, 1, 1)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 1/2));

          const uvs = geometry.getAttribute('uv').array;
          uvs.fill(1);

          return geometry;
        })();

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(NUM_POSITIONS);
        const normals = new Float32Array(NUM_POSITIONS);
        const uvs = new Float32Array(NUM_POSITIONS);
        const indices = new Uint16Array(NUM_POSITIONS);
        let attributeIndex = 0;
        let uvIndex = 0;
        let indexIndex = 0;
        [
          backGeometry,
          frontGeometry,
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

        return geometry;
      })();
      objectApi.registerGeometry('glass', glassGeometry);

      objectApi.registerGenerator('fake', chunk => { // XXX
        if (chunk.x === 0 && chunk.z === -1) {
          objectApi.setBlock(chunk, chunk.x * NUM_CELLS + 4, 5 * NUM_CELLS + 4, chunk.z * NUM_CELLS + 4, 'house-plank');

          objectApi.setBlock(chunk, chunk.x * NUM_CELLS + 3, 5 * NUM_CELLS + 4, chunk.z * NUM_CELLS + 4, 'house-plank');
          objectApi.setBlock(chunk, chunk.x * NUM_CELLS + 5, 5 * NUM_CELLS + 4, chunk.z * NUM_CELLS + 4, 'house-plank');
          objectApi.setBlock(chunk, chunk.x * NUM_CELLS + 4, 5 * NUM_CELLS + 4, chunk.z * NUM_CELLS + 3, 'house-plank');
          objectApi.setBlock(chunk, chunk.x * NUM_CELLS + 4, 5 * NUM_CELLS + 4, chunk.z * NUM_CELLS + 5, 'house-plank');
          objectApi.setBlock(chunk, chunk.x * NUM_CELLS + 4, 5 * NUM_CELLS + 5, chunk.z * NUM_CELLS + 4, 'house-plank');
          objectApi.setBlock(chunk, chunk.x * NUM_CELLS + 4, 5 * NUM_CELLS + 3, chunk.z * NUM_CELLS + 4, 'house-plank');

          objectApi.setBlock(chunk, chunk.x * NUM_CELLS + 2, 5 * NUM_CELLS + 4, chunk.z * NUM_CELLS + 4, 'house-plank');

          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              objectApi.setBlock(chunk, chunk.x * NUM_CELLS + 4 + dx, 5 * NUM_CELLS + 2, chunk.z * NUM_CELLS + 4 + dz, 'house-plank');
            }
          }
        }
      });

      objectApi.registerGenerator('house', chunk => {
        if (chunk.x === 0 && chunk.z === -1) {
          const elevation = Math.floor(objectApi.getHeightfield(chunk.x, chunk.z)[(0 + (0 * NUM_CELLS_OVERSCAN)) * 8]);

          const localVector = new THREE.Vector3();
          const localQuaternion = new THREE.Quaternion();

          for (let y = 0; y < HOUSE_SPEC.length; y++) {
            const layer = HOUSE_SPEC[y];

            for (let z = 0; z < layer.length; z++) {
              const row = layer[z];

              for (let x = 0; x < layer.length; x++) {
                const col = row[x];

                if (col) {
                  const objectType = (() => {
                    if (col === 'stone-stairs') {
                      return 'stone-stairs';
                    } else if (col === 'fence-nw' || col === 'fence-ne' || col === 'fence-sw' || col === 'fence-se') {
                      return 'fence-nw';
                    } else if (col === 'fence-top' || col === 'fence-side') {
                      return 'fence-top';
                    } else if (col === 'fence') {
                      return 'fence';
                    } else if (col === 'ladder') {
                      return 'ladder';
                    } else if (col === 'glass-top' || col === 'glass-west' || col === 'glass-east') {
                      return 'glass';
                    } else if (col === 'torch') {
                      return 'torch';
                    } else {
                      return null;
                    }
                  })();
                  if (objectType) {
                    if (col === 'fence-ne') {
                      localQuaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 0, -1),
                        new THREE.Vector3(1, 0, 0)
                      );
                    } else if (col === 'fence-se') {
                      localQuaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 0, -1),
                        new THREE.Vector3(0, 0, 1)
                      );
                    } else if (col === 'fence-sw') {
                      localQuaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 0, -1),
                        new THREE.Vector3(-1, 0, 0)
                      );
                    } else if (col === 'fence-side') {
                      localQuaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 0, -1),
                        new THREE.Vector3(-1, 0, 0)
                      );
                    } else if (col === 'glass-west') {
                      localQuaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 0, -1),
                        new THREE.Vector3(-1, 0, 0)
                      );
                    } else if (col === 'glass-east') {
                      localQuaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 0, -1),
                        new THREE.Vector3(1, 0, 0)
                      );
                    } else {
                      localQuaternion.set(0, 0, 0, 1);
                    }
                    objectApi.addObject(chunk, objectType, localVector.set(chunk.x * NUM_CELLS + x + 0.5, elevation + y + 0.5, chunk.z * NUM_CELLS + z + 0.5), localQuaternion, 0);
                  } else {
                    const blockType = (() => {
                      if (col === 'stone') {
                        return 'house-stone';
                      } else if (col === 'oak-wood-planks') {
                        return 'house-plank';
                      } else {
                        return 'house-wood';
                      }
                    })();
                    objectApi.setBlock(chunk, chunk.x * NUM_CELLS + x, elevation + y, chunk.z * NUM_CELLS + z, blockType);
                  }
                }
              }
            }
          }
        }
      });

      return () => {
      };
    });
};

module.exports = house;
