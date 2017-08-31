const path = require('path');

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('../../constants/constants');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const NUM_POSITIONS = 10 * 1024;

const _parseSpec = s => {
  const lines = s.split('\n');
  const legend = (() => {
    const result = {};
    const headerString = lines[0];
    const legendEntries = headerString.split('|');
    for (let i = 0; i < legendEntries.length; i++) {
      const match = legendEntries[i].match(/^(.)=(.+)$/);
      result[match[1]] = match[2];
    }
    return result;
  })();

  const result = [];
  let currentLayer = null;
  const layersLines = lines.slice(1);
  for (let i = 0; i < layersLines.length; i++) {
    const layerLine = layersLines[i];

    if (layerLine[0] === '|') {
      if (currentLayer) {
        result.push(currentLayer);
        currentLayer = null;
      }
    } else {
      if (!currentLayer) {
        currentLayer = [];
      }

      const row = [];
      for (let j = 0; j < layerLine.length; j++) {
        const c = layerLine[j];
        row.push(c === ' ' ? null : legend[c]);
      }
      currentLayer.push(row);
    }
  }
  if (currentLayer) {
    result.push(currentLayer);
    currentLayer = null;
  }
  return result;
};

const HOUSE_SPEC = _parseSpec(`\
c=cobblestone|s=cobblestone-stairs|j=oak-wood-planks|H=ladder|g=glass-pane|!=torch|w=oak-wood|f=fence
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
cjgjc
j  Hj
g   g
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
fffff
f   f
f   f
f   f
fffff
     
`);

const house = objectApi => {
  return () => Promise.all([
    jimp.read(path.join(__dirname, '../../img/wood.png'))
      .then(houseImg => objectApi.registerTexture('house', houseImg)),
    jimp.read(path.join(__dirname, '../../img/fence.png'))
      .then(fenceImg => objectApi.registerTexture('fence', fenceImg)),
    jimp.read(path.join(__dirname, '../../img/ladder.png'))
      .then(ladderImg => objectApi.registerTexture('ladder', ladderImg)),
    /* jimp.read(path.join(__dirname, '../../img/door.png'))
      .then(doorImg => objectApi.registerTexture('door', doorImg)), */
  ])
    .then(() => {
      const houseGeometry = (() => {
        const woodUvs = objectApi.getUv('house');
        const uvWidth = woodUvs[2] - woodUvs[0];
        const uvHeight = woodUvs[3] - woodUvs[1];

        const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, 0));

        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = woodUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (woodUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('house', houseGeometry);

      const stairsGeometry = (() => {
        const woodUvs = objectApi.getUv('house');
        const uvWidth = woodUvs[2] - woodUvs[0];
        const uvHeight = woodUvs[3] - woodUvs[1];

        const geometry = (() => {
          const frontGeometry = new THREE.BoxBufferGeometry(1, 1/4, 1)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/4/2, 0));

          const middleGeometry = new THREE.BoxBufferGeometry(1, 1/4, 2/3)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/4/2 + 1/4, -1/3/2));

          const backGeometry = new THREE.BoxBufferGeometry(1, 1/4, 1/3)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/4/2 + 2/4, -2/3/2));

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
      objectApi.registerGeometry('stairs', stairsGeometry);

      const fenceGeometry = (() => {
        const woodUvs = objectApi.getUv('fence');
        const uvWidth = woodUvs[2] - woodUvs[0];
        const uvHeight = woodUvs[3] - woodUvs[1];

        const geometry = new THREE.PlaneBufferGeometry(1, 1/2, 1)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2/2, 0));

        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = woodUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (woodUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('fence', fenceGeometry);

      const ladderGeometry = (() => {
        const woodUvs = objectApi.getUv('ladder');
        const uvWidth = woodUvs[2] - woodUvs[0];
        const uvHeight = woodUvs[3] - woodUvs[1];

        const geometry = new THREE.PlaneBufferGeometry(1, 1, 1)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, -1/2 + 0.05));

        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = woodUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (woodUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('ladder', ladderGeometry);

      objectApi.registerGenerator('house', chunk => {
        if (chunk.x === 0 && chunk.z === -1) {
          const elevation = chunk.heightfield[(0 + (0 * NUM_CELLS_OVERSCAN)) * 8];
          // const elevation = chunk.heightfield[(dx + (dz * NUM_CELLS_OVERSCAN)) * 8];

          const localVector = new THREE.Vector3();
          const localQuaternion = new THREE.Quaternion();

          for (let y = 0; y < HOUSE_SPEC.length; y++) {
            const layer = HOUSE_SPEC[y];

            for (let z = 0; z < layer.length; z++) {
              const row = layer[z];

              for (let x = 0; x < layer.length; x++) {
                const col = row[x];

                if (col) {
                  const block = (() => {
                    if (col === 'cobblestone-stairs') {
                      return 'stairs';
                    } else if (col === 'fence') {
                      return 'fence';
                    } else if (col === 'ladder') {
                      return 'ladder';
                    } else if (col === 'torch') {
                      return 'torch';
                    } else {
                      return 'house';
                    }
                  })();
                  objectApi.addObject(chunk, block, localVector.set(x, elevation + y, z), localQuaternion, 0);
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
