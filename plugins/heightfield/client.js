const {
  NUM_CELLS,

  NUM_CELLS_HEIGHT,
  HEIGHT_OFFSET,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 100 * 1024;

class Heightfield {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, world, teleport, /*physics,*/ stck, utils: {random: {chnkr}}} = zeo;
    const {THREE, scene} = three;

    const mapChunkMaterial = new THREE.MeshPhongMaterial({
      // color: 0xFFFFFF,
      shininess: 0,
      shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      // side: THREE.DoubleSide,
    });

    const worker = new Worker('archae/plugins/_plugins_heightfield/build/worker.js');
    const queue = [];
    worker.requestOriginHeight = () => new Promise((accept, reject) => {
      worker.postMessage({
        method: 'getOriginHeight',
      });
      queue.push(originHeight => {
        accept(originHeight);
      });
    });
    worker.requestGenerate = (x, y) => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 3);
      worker.postMessage({
        method: 'generate',
        args: {
          x,
          y,
          buffer,
        },
      }, [buffer]);
      queue.push(buffer => {
        accept(buffer);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    const _bootstrap = () => worker.requestOriginHeight()
      .then(originHeight => {
        world.setSpawnMatrix(new THREE.Matrix4().makeTranslation(0, originHeight, 0));
      });

    const _requestGenerate = (x, y) => worker.requestGenerate(x, y)
      .then(mapChunkBuffer => protocolUtils.parseMapChunk(mapChunkBuffer));

    const _makeMapChunkMesh = (mapChunkData, x, z) => {
      const {position, positions, normals, colors, heightfield, heightRange} = mapChunkData;

      const geometry = (() => {
        let geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        const initialColors = new Float32Array(colors.length);
        initialColors.set(colors);
        geometry.initialColors = initialColors;
        const [minY, maxY] = heightRange;
        geometry.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(
            (x * NUM_CELLS) + (NUM_CELLS / 2),
            (minY + maxY) / 2,
            (z * NUM_CELLS) + (NUM_CELLS / 2)
          ),
          Math.max(Math.sqrt((NUM_CELLS / 2) * (NUM_CELLS / 2) * 3), (maxY - minY) / 2)
        );
        return geometry;
      })();
      const material = mapChunkMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      // mesh.frustumCulled = false;

      mesh.heightfield = heightfield;

      const lightmap = new Uint8Array((NUM_CELLS + 1) * (NUM_CELLS + 1) * NUM_CELLS_HEIGHT);
      let ambient = 0;
      const _clamp = (n, l) => Math.min(Math.max(n, 0), l);
      const _isInRange = (n, l) => n >= 0 && n <= l;
      mesh.setAmbient = newAmbient => {
        ambient = newAmbient;
      };
      mesh.setSphere = (x, y, z, r) => {
        const dr = r - 1;
        const maxDistance = Math.sqrt(dr*dr*3);
        for (let dx = -dr; dx <= dr; dx++) {
          for (let dy = -dr; dy <= dr; dy++) {
            for (let dz = -dr; dz <= dr; dz++) {
              const lx = Math.floor(x + dx);
              const ly = Math.floor(y + dy - HEIGHT_OFFSET);
              const lz = Math.floor(z + dz);

              if (_isInRange(lx, NUM_CELLS + 1) && _isInRange(ly, NUM_CELLS_HEIGHT) && _isInRange(lz, NUM_CELLS + 1)) {
                const lightmapIndex = lx + (ly * (NUM_CELLS + 1)) + (lz * (NUM_CELLS + 1) * (NUM_CELLS + 1));
                lightmap[lightmapIndex] = Math.max(
                  (maxDistance - new THREE.Vector3(dx, dy, dz).length()) / maxDistance * 255,
                  lightmap[lightmapIndex]
                );
              }
            }
          }
        }
      };
      mesh.resetLightmap = () => {
        lightmap.fill(0);
      };
      mesh.bakeLightmap = () => {
        const {geometry} = mesh;
        const positions = geometry.getAttribute('position').array;
        const colorAttribute = geometry.getAttribute('color');
        const colors = colorAttribute.array;
        const {initialColors} = geometry;
        const numPositions = positions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          const baseIndex = i * 3;
          const x = _clamp(Math.floor(positions[baseIndex + 0]), NUM_CELLS + 1);
          const y = _clamp(Math.floor(positions[baseIndex + 1] - HEIGHT_OFFSET), NUM_CELLS_HEIGHT);
          const z = _clamp(Math.floor(positions[baseIndex + 2]), NUM_CELLS + 1);
          const lightmapIndex = x + (y * (NUM_CELLS + 1)) + (z * (NUM_CELLS + 1) * (NUM_CELLS + 1));
          const v = (lightmap[lightmapIndex] + ambient) / 255;

          colors[baseIndex + 0] = initialColors[baseIndex + 0] * v;
          colors[baseIndex + 1] = initialColors[baseIndex + 1] * v;
          colors[baseIndex + 2] = initialColors[baseIndex + 2] * v;
        }

        colorAttribute.needsUpdate = true;
      };
      mesh.destroy = () => {
        geometry.dispose();
      };

      mesh.setAmbient(255 * 0.5);
      mesh.setSphere(NUM_CELLS / 2, 32, NUM_CELLS / 2, 10);
      mesh.bakeLightmap();

      return mesh;
    };

    const chunker = chnkr.makeChunker({
      resolution: 32,
      range: 4,
    });

    const _requestRefreshMapChunks = () => {
      const {hmd} = pose.getStatus();
      const {worldPosition: hmdPosition} = hmd;
      const {added, removed, relodded} = chunker.update(hmdPosition.x, hmdPosition.z);
      let retargeted = false;

      const _addTarget = (mapChunkMesh, x, z) => {
        teleport.addTarget(mapChunkMesh, {
          flat: true,
        });

        /* const physicsBody = physics.makeBody(mapChunkMesh, 'heightfield:' + x + ':' + z, {
          mass: 0,
          position: [
            (NUM_CELLS / 2) + (x * NUM_CELLS),
            0,
            (NUM_CELLS / 2) + (z * NUM_CELLS)
          ],
          linearFactor: [0, 0, 0],
          angularFactor: [0, 0, 0],
          bindObject: false,
          bindConnection: false,
        });
        mapChunkMesh.physicsBody = physicsBody; */
        const {heightfield} = mapChunkMesh;
        const stckBody = stck.makeStaticHeightfieldBody(
          [
            x * NUM_CELLS,
            0,
            z * NUM_CELLS,
          ],
          NUM_CELLS,
          NUM_CELLS,
          heightfield
        );
        mapChunkMesh.stckBody = stckBody;

        mapChunkMesh.targeted = true;
      };
      const _removeTarget = mapChunkMesh => {
        teleport.removeTarget(mapChunkMesh);

        /* const {physicsBody} = mapChunkMesh;
        physics.destroyBody(physicsBody); */
        const {stckBody} = mapChunkMesh;
        stck.destroyBody(stckBody);

        mapChunkMesh.targeted = false;
      };

      const addedPromises = added.map(chunk => {
        const {x, z} = chunk;

        return _requestGenerate(x, z)
          .then(mapChunkData => {
            const mapChunkMesh = _makeMapChunkMesh(mapChunkData, x, z);
            scene.add(mapChunkMesh);

            const {lod} = chunk;
            if (lod === 1 && !mapChunkMesh.targeted) {
              _addTarget(mapChunkMesh, x, z);

              retargeted = true;
            }

            chunk.data = mapChunkMesh;
          });
      });
      return Promise.all(addedPromises)
        .then(() => {
          removed.forEach(chunk => {
            const {data: mapChunkMesh} = chunk;
            scene.remove(mapChunkMesh);
            mapChunkMesh.destroy();

            const {lod} = chunk;
            if (lod !== 1 && mapChunkMesh.targeted) {
              _removeTarget(mapChunkMesh);

              retargeted = true;
            }
          });
          relodded.forEach(chunk => {
            const {x, z, lod, data: mapChunkMesh} = chunk;

            if (lod === 1 && !mapChunkMesh.targeted) {
              _addTarget(mapChunkMesh, x, z);

              retargeted = true;
            } else if (lod !== 1 && mapChunkMesh.targeted) {
              _removeTarget(mapChunkMesh);

              retargeted = true;
            }
          });
        })
        .then(() => {
          if (retargeted) {
            teleport.reindex();
          }
        });
    };

    return _bootstrap()
      .then(() => {
        let updating = false;
        let updateQueued = false;
        const tryMapChunkUpdate = () => {
          if (!updating) {
            updating = true;

            const done = () => {
              updating = false;

              if (updateQueued) {
                updateQueued = false;

                tryMapChunkUpdate();
              }
            };

            _requestRefreshMapChunks()
              .then(done)
              .catch(err => {
                console.warn(err);

                done();
              });
          } else {
            updateQueued = true;
          }
        };

        const _update = () => {
          tryMapChunkUpdate();
        };
        render.on('update', _update);

        this._cleanup = () => {
          // XXX remove chunks from the scene here

          render.removeListener('update', _update);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Heightfield;
