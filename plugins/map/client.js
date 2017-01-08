const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const DIRECTIONS = [
  [-1,-1],
  [-1,0],
  [-1,1],
  [0,-1],
  [0,0],
  [0,1],
  [1,-1],
  [1,0],
  [1,1],
];

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
          count: 4,
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

              return Promise.all(DIRECTIONS.map(([x, y]) => {
                return worker.request('generate', [
                  {
                    offset: {
                      x,
                      y,
                    },
                    position: {
                      x: x * NUM_CELLS,
                      y: y * NUM_CELLS,
                    },
                  }
                ]).then(({mapChunk: mapChunkBuffer}) => {
                  const mapChunk = protocolUtils.parseMapChunk(mapChunkBuffer);
                  const mesh = _makeMapChunkMesh(mapChunk);
                  scene.add(mesh);

                  cleanups.push(() => {
                    scene.remove(mesh);
                  });
                });
              })).then(() => {
                console.log('map done');
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
