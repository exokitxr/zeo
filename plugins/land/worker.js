const THREE = require('three');
const geometryutils = require('geometryutils')({THREE});
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

    const geometry = geometryutils.unindexBufferGeometry(
      new THREE.PlaneBufferGeometry(size, size, size * 2, size * 2)
        .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
    );
    const positions = geometry.getAttribute('position').array;
    const normals = geometry.getAttribute('normal').array;

    const numPoints = positions.length / 3;
    for (let i = 0; i < numPoints; i++) {
      const baseIndex = i * 3;
      const ax = positions[baseIndex + 0] + (size / 2);
      const ay = positions[baseIndex + 2] + (size / 2);
      const x = Math.floor(ax);
      const y = Math.floor(ay);
      const xr = Math.floor(ax / 0.5) % 2;
      const yr = Math.floor(ay / 0.5) % 2;
      positions[baseIndex + 1] = -0.25 +
        (heightmapNoise.in2D(
          -(size / 2) + x + (xr / resolution),
          -(size / 2) + y + (yr / resolution)
        ) * 0.5);
    }

    self.postMessage({
      id: id,
      error: null,
      result: {
        positions,
        normals,
      },
    }, [
      positions.buffer,
      normals.buffer,
    ]);
  } else {
    console.warn('unknown method: ' + method);

    self.close();
  }
};

self.module = {};
