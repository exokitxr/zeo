class Map {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

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

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        return archae.requestWorker(this, {
          count: 2,
        })
          .then(worker => {
            if (live) {
              const mapChunkMaterial = new THREE.MeshLambertMaterial({
                color: 0xFFFFFF,
                // emissive: 0x333333,
                // specular: 0x000000,
                // shininess: 0,
                // side: THREE.DoubleSide,
                shading: THREE.FlatShading,
                vertexColors: THREE.VertexColors,
              });

              const _makeMapChunkMesh = mapChunk => {
                const {position, positions, normals, colors, boundingSphere} = mapChunk;

                const geometry = (() => {
                  const geometry = new THREE.BufferGeometry();

                  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                  geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
                  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

                  geometry.computeBoundingSphere();

                  return geometry;
                })();
                const material = mapChunkMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.frustumCulled = false;
                return mesh;
              };

              cleanups.push(() => {
                worker.terminate();
              });

              return worker.request('generate', [
                offset: {
                  x: 0,
                  y: 0,
                },
                position: {
                  x: 0,
                  y: 0,
                },
              ]).then(mapChunk => {
                const mesh = _makeMapChunkMesh(mapChunk);
                scene.add(mesh);

                cleanups.push(() => {
                  scene.remove(mesh);
                });
              });
            } else {
              worker.terminate();
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Map;
