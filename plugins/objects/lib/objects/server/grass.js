const grass = objectApi => {
  return () => new Promise((accept, reject) => {

    objectApi.registerGenerator('grass', (chunk, generateApi) => {
      const localVector = new generateApi.THREE.Vector3();
      const zeroQuaternion = new generateApi.THREE.Quaternion();
      const oneVector = new generateApi.THREE.Vector3(1, 1, 1);

      const grassProbability = 0.3;

      for (let dz = 0; dz < generateApi.NUM_CELLS_OVERSCAN; dz++) {
        for (let dx = 0; dx < generateApi.NUM_CELLS_OVERSCAN; dx++) {
          const v = generateApi.getGrassNoise(chunk.x, chunk.z, dx, dz);

          if (v < grassProbability) {
            const elevation = generateApi.getElevation(chunk.x, chunk.z, dx, dz);

            const ax = (chunk.x * generateApi.NUM_CELLS) + dx;
            const az = (chunk.z * generateApi.NUM_CELLS) + dz;
            localVector.set(ax, elevation, az);
            generateApi.addObject(chunk, 'grass', localVector, zeroQuaternion, oneVector);
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
