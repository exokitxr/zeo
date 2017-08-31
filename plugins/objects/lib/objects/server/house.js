const path = require('path');

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('../../constants/constants');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

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
  return () => jimp.read(path.join(__dirname, '../../img/wood.png'))
    .then(woodImg => objectApi.registerTexture('house', woodImg))
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
                const block = row[x];

                if (block) {
                  objectApi.addObject(chunk, 'house', localVector.set(x, elevation + y, z), localQuaternion, 0);
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
