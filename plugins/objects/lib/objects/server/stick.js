const stick = objectApi => {
  return () => new Promise((accept, reject) => {
    objectApi.registerGenerator('stick', (chunk, generateApi) => {
      const localVector = new generateApi.THREE.Vector3();
      const localQuaternion = new generateApi.THREE.Quaternion();
      const localEuler = new generateApi.THREE.Euler();

      const _getElevation = (ox, oz, x, z) => (-0.3 + Math.pow(generateApi.getNoise('elevation', ox, oz, x, z), 0.5)) * 64;

      const itemProbability = 0.05;

      for (let dz = 0; dz < generateApi.NUM_CELLS_OVERSCAN; dz++) {
        for (let dx = 0; dx < generateApi.NUM_CELLS_OVERSCAN; dx++) {
          const v = generateApi.getNoise('items', chunk.x, chunk.z, dx, dz);

          if (v < itemProbability && (generateApi.getHash(String(v)) % 2) === 1) {
            const elevation = _getElevation(chunk.x, chunk.z, dx, dz);

            const ax = (chunk.x * generateApi.NUM_CELLS) + dx;
            const az = (chunk.z * generateApi.NUM_CELLS) + dz;
            localVector.set(ax, elevation, az);
            localQuaternion.setFromEuler(localEuler.set(
              0,
              generateApi.getHash(String(v)) / 0xFFFFFFFF * Math.PI * 2,
              0,
              'YXZ'
            ));
            generateApi.addObject(chunk, 'stick', localVector, localQuaternion, 0);
          }
        }
      }
    });

    accept(() => {
      // XXX
    });
  });
};

module.exports = stick;
