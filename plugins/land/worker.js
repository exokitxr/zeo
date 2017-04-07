const alea = require('alea');
const indev = require('indev');

const DEFAULT_SEED = 'zeo';
const rng = new alea(DEFAULT_SEED);
const generator = indev({
  random: rng,
});

self.onmessage = e => {
  const {data} = e;
  const {method} = data;

  if (method === 'generate') {
    const {args, id} = data;
    const [frequency, octaves, size, resolution] = args;

    const heightmapNoise = generator.uniform({
      frequency: frequency,
      octaves: octaves,
    });

    const array = new Float32Array((size + 1) * resolution * (size + 1) * resolution);
    for (let y = 0; y <= size; y++) {
      for (let yr = 0; yr < resolution; yr++) {
        for (let x = 0; x <= size; x++) {
          for (let xr = 0; xr < resolution; xr++) {
            array[
              ((y * (size * resolution * resolution))) + (yr * (size * resolution)) + (x * resolution) + xr
            ] =
              heightmapNoise.in2D(
                -(size / 2) + x + (xr / resolution),
                -(size / 2) + y + (yr / resolution)
              );
          }
        }
      }
    }
    const {buffer: result} = array;

    self.postMessage({
      id: id,
      error: null,
      result: result,
    }, [
      result,
    ]);
  } else {
    console.warn('unknown method: ' + method);

    self.close();
  }
};

self.module = {};
