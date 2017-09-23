const path = require('path');

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const craftingTable = objectApi => {
  return () => Promise.all([
    jimp.read(path.join(__dirname, '../../img/crafting-table-top.png'))
      .then(img => objectApi.registerTexture('craftingTableTop', img, {fourTap: true})),
    jimp.read(path.join(__dirname, '../../img/crafting-table-front.png'))
      .then(img => objectApi.registerTexture('craftingTableFront', img, {fourTap: true})),
    jimp.read(path.join(__dirname, '../../img/crafting-table-side.png'))
      .then(img => objectApi.registerTexture('craftingTableSide', img, {fourTap: true})),
  ])
    .then(() => {
      /* const craftingTableGeometry = (() => {
        const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          let textureName;
          if (
            i === 16 || i === 17 || i === 18 || i === 19 // front
          ) {
            textureName = 'craftingTableFront';
          } else if (
            i === 0 || i === 1 || i === 2 || i === 3 || // right
            i === 4 || i === 5 || i === 6 || i === 7 || // left
            i === 20 || i === 21 || i === 22 || i === 23 // back
          ) {
            textureName = 'craftingTableSide';
          } else if (
            i === 8 || i === 9 || i === 10 || i === 11 || // top
            i === 12 || i === 13 || i === 14 || i === 15 // bottom
          ) {
            textureName = 'craftingTableTop';
          } else {
            textureName = 'craftingTableFront';
          }

          const craftingTableUvs = objectApi.getUv(textureName);
          const uvWidth = craftingTableUvs[2] - craftingTableUvs[0];
          const uvHeight = craftingTableUvs[3] - craftingTableUvs[1];
          uvs[i * 2 + 0] = craftingTableUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (craftingTableUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })();
      objectApi.registerGeometry('craftingTable', craftingTableGeometry); */

      const craftingTableSideUvs = objectApi.getTileUv('craftingTableSide');
      const craftingTableFrontUvs = objectApi.getTileUv('craftingTableFront');
      const craftingTableTopUvs = objectApi.getTileUv('craftingTableTop');
      const craftingTableBlock = {
        uvs: [
          craftingTableSideUvs,
          craftingTableSideUvs,
          craftingTableTopUvs,
          craftingTableTopUvs,
          craftingTableSideUvs,
          craftingTableFrontUvs,
        ],
        transparent: false,
        translucent: false,
      };
      objectApi.registerBlock('crafting-table', craftingTableBlock);

      return () => {
      };
    });
};

module.exports = craftingTable;
