class Planet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three: {THREE, scene, camera}, render} = zeo;

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
      const ellipseFn = (x, y, z) => Math.sqrt(Math.pow(x * 2, 2) + Math.pow(y, 2) + Math.pow(z, 2)) - 0.2;

      const size = 50;
      const width = size;
      const height = size;
      const depth = size;
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
              data[index] = ellipseFn(
                (x - (width / 2)) / width,
                (y - (height / 2)) / height,
                (z - (depth / 2)) / depth
              );
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
