const stone = objectApi => {
  return () => new Promise((accept, reject) => {
    objectApi.registerGenerator('stone', (chunk, generateApi) => {
      const localVector = new generateApi.THREE.Vector3();
      const localQuaternion = new generateApi.THREE.Quaternion();
      const localEuler = new generateApi.THREE.Euler();

      const itemProbability = 0.05;

      for (let dz = 0; dz < generateApi.NUM_CELLS_OVERSCAN; dz++) {
        for (let dx = 0; dx < generateApi.NUM_CELLS_OVERSCAN; dx++) {
          const v = generateApi.getNoise('items', chunk.x, chunk.z, dx, dz);

          if (v < itemProbability && (generateApi.getHash(String(v)) % 2) === 0) {
            const elevation = chunk.heightfield[(dx + (dz * generateApi.NUM_CELLS_OVERSCAN)) * 8];

            if (elevation > 64) {
              const ax = (chunk.x * generateApi.NUM_CELLS) + dx;
              const az = (chunk.z * generateApi.NUM_CELLS) + dz;
              localVector.set(ax, elevation, az);
              localQuaternion.setFromEuler(localEuler.set(
                0,
                generateApi.getHash(String(v)) / 0xFFFFFFFF * Math.PI * 2,
                0,
                'YXZ'
              ));
              generateApi.addObject(chunk, 'stone', localVector, localQuaternion, 0);
            }
          }
        }
      }
    });

    accept(() => {
      // XXX
    });
  });
};

module.exports = stone;
