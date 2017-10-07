const grass = objectApi => {
  return () => new Promise((accept, reject) => {
    objectApi.registerGenerator('grass', (chunk, generateApi) => {
      const localVector = new generateApi.THREE.Vector3();
      const localQuaternion = new generateApi.THREE.Quaternion();
      const localEuler = new generateApi.THREE.Euler();

      const grassProbability = 0.3;

      for (let dz = 0; dz < generateApi.NUM_CELLS; dz++) {
        for (let dx = 0; dx < generateApi.NUM_CELLS; dx++) {
          const v = generateApi.getNoise('grass', chunk.x, chunk.z, dx, dz);

          if (v < grassProbability) {
            const elevation = Math.floor(objectApi.getElevation(chunk.x * NUM_CELLS + dx, chunk.z * NUM_CELLS + dz));

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
              generateApi.addObject(chunk, 'grass', localVector, localQuaternion, 0);
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

module.exports = grass;
