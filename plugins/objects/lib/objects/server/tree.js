const tree = objectApi => {
  return () => new Promise((accept, reject) => {
    objectApi.registerGenerator('tree', (chunk, generateApi) => {
      const localVector = new generateApi.THREE.Vector3();
      const localQuaternion = new generateApi.THREE.Quaternion();
      const localEuler = new generateApi.THREE.Euler();
      const oneVector = new generateApi.THREE.Vector3(1, 1, 1);

      const _getElevation = (ox, oz, x, z) => (-0.3 + Math.pow(generateApi.getNoise('elevation', ox, oz, x, z), 0.5)) * 64;

      const treeProbability = 0.015;

      for (let dz = 0; dz < generateApi.NUM_CELLS_OVERSCAN; dz++) {
        for (let dx = 0; dx < generateApi.NUM_CELLS_OVERSCAN; dx++) {
          const elevation = _getElevation(chunk.x, chunk.z, dx, dz);

          if (elevation > 0) {
            const v = generateApi.getNoise('tree', chunk.x, chunk.z, dx, dz);

            if (v < treeProbability) {
              const ax = (chunk.x * generateApi.NUM_CELLS) + dx;
              const az = (chunk.z * generateApi.NUM_CELLS) + dz;
              localVector.set(ax, elevation, az);
              localQuaternion.setFromEuler(localEuler.set(
                0,
                generateApi.getHash(String(v)) / 0xFFFFFFFF * Math.PI * 2,
                0,
                'YXZ'
              ));
              generateApi.addObject(chunk, 'tree', localVector, localQuaternion, oneVector);
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

module.exports = tree;
