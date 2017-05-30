const indev = require('indev');

class Planet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three: {THREE, scene, camera}, render, utils: {random: randomUtils}} = zeo;
    const {alea} = randomUtils;

    const rng = new alea('');
    const generator = indev({
      random: rng,
    });
    const elevationNoise = generator.uniform({
      frequency: 0.1,
      octaves: 8,
    });

    const size = 50;
    const width = size;
    const height = size;
    const depth = size;
    const innerRadius = 8;
    const innerSize = innerRadius * 2;
    const _makeHeightField = (x, y) => {
      const result = new Float32Array(innerSize * innerSize);

      for (let i = 0; i < innerSize; i++) {
        for (let j = 0; j < innerSize; j++) {
          const index = i + (j * innerSize);
          result[index] = elevationNoise.in2D((x * innerSize) + i, (y * innerSize) + j) * 10;
        }
      }

      return result;
    };

    const heightFields = {
      front: _makeHeightField(0, 0),
      top: _makeHeightField(0, -1),
      bottom: _makeHeightField(0, 1),
      left: _makeHeightField(-1, 0),
      right: _makeHeightField(1, 0),
      back: _makeHeightField(2, 0),
    };

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    const planetMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      shading: THREE.FlatShading,
    });
    cleanups.push(() => {
      planetMaterial.dispose();
    });

    const _requestMarchingCubes = () => {
      // const ellipseFn = (x, y, z) => Math.sqrt(Math.pow(x * 2, 2) + Math.pow(y, 2) + Math.pow(z, 2)) - 0.2;

      const _getCoordIndex = (x, y, z) => x + (y * width) + (z * width * height);
      const body = (() => {
        const result = new Uint8Array((3 * 4) + (width * height * depth * 4));

        new Uint32Array(result.buffer, 4 * 0, 4 * 1, 1)[0] = width;
        new Uint32Array(result.buffer, 4 * 1, 4 * 2, 1)[0] = height;
        new Uint32Array(result.buffer, 4 * 2, 4 * 3, 1)[0] = depth;

        const data = new Float32Array(result.buffer, 3 * 4);
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z++) {
              const index = _getCoordIndex(x, y, z);
              const dx = x - (width / 2);
              const dy = y - (height / 2);
              const dz = z - (depth / 2);
              const ax = Math.abs(dx);
              const ay = Math.abs(dy);
              const az = Math.abs(dz);
              const v = (() => {
                if (ax <= innerRadius && ay <= innerRadius && az <= innerRadius) {
                  return -1;
                } else if (dx > innerRadius && ay <= innerRadius && az <= innerRadius) { // right
                  const ox = dx - innerRadius;
                  const oy = dy + innerRadius;
                  const oz = dz + innerRadius;
                  if (heightFields.right[oy + (oz * innerSize)] >= ox) {
                    return -1;
                  } else {
                    return 1;
                  }
                } else if (dx < innerRadius && ay <= innerRadius && az <= innerRadius) { // left
                  const ox = - dx - innerRadius;
                  const oy = dy + innerRadius;
                  const oz = dz + innerRadius;
                  if (heightFields.left[oy + (oz * innerSize)] >= ox) {
                    return -1;
                  } else {
                    return 1;
                  }
                } else if (dy > innerRadius && ax <= innerRadius && az <= innerRadius) { // top
                  const ox = dx + innerRadius;
                  const oy = dy - innerRadius;
                  const oz = dz + innerRadius;
                  if (heightFields.top[ox + (oz * innerSize)] >= oy) {
                    return -1;
                  } else {
                    return 1;
                  }
                } else if (dy < innerRadius && ax <= innerRadius && az <= innerRadius) { // bottom
                  const ox = dx + innerRadius;
                  const oy = - dy - innerRadius;
                  const oz = dz + innerRadius;
                  if (heightFields.bottom[ox + (oz * innerSize)] >= oy) {
                    return -1;
                  } else {
                    return 1;
                  }
                } else if (dz > innerRadius && ax <= innerRadius && ay <= innerRadius) { // front
                  const ox = dx + innerRadius;
                  const oy = dy + innerRadius;
                  const oz = dz - innerRadius;
                  if (heightFields.front[ox + (oy * innerSize)] >= oz) {
                    return -1;
                  } else {
                    return 1;
                  }
                } else if (dz < innerRadius && ax <= innerRadius && ay <= innerRadius) { // back
                  const ox = dx + innerRadius;
                  const oy = dy + innerRadius;
                  const oz = -dz - innerRadius;
                  if (heightFields.back[ox + (oy * innerSize)] >= oz) {
                    return -1;
                  } else {
                    return 1;
                  }
                } else {
                  return 1;
                }
              })();
              data[index] = v;
            }
          }
        }

        return result;
      })();

      return fetch('/archae/planet/marchingcubes', {
        method: 'POST',
        body: body,
      })
        .then(res => res.arrayBuffer())
        .then(marchingCubesBuffer => {
          const marchingCubesArray = new Uint8Array(marchingCubesBuffer);
          const numPositions = new Uint32Array(marchingCubesBuffer, 4 * 0, 1)[0];
          const numNormals = new Uint32Array(marchingCubesBuffer, 4 * 1, 1)[0];
          const positions = new Float32Array(marchingCubesBuffer, 2 * 4, numPositions);
          const normals = new Float32Array(marchingCubesBuffer, (2 * 4) + (numPositions * 4), numNormals);
          return {
            positions,
            normals,
          };
        });
    };

    return _requestMarchingCubes()
      .then(marchingCubes => {
        if (live) {
          const planetMesh = (() => {
            const {positions, normals} = marchingCubes;

            const geometry = (() => {
              const geometry = new THREE.BufferGeometry();
              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
              return geometry;
            })();
            const material = planetMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          scene.add(planetMesh);

          cleanups.push(() => {
            scene.remove(planetMesh);
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Planet;
