const protocolUtils = require('./lib/utils/protocol-utils');

const RESOLUTION = 32;
const BUFFER_SIZE = 1000 * 1024;

const DIRECTIONS = (() => {
  const result = [];
  for (let x = -1; x <= 1; x++) {
    if (x !== 0) {
      for (let y = -1; y <= 1; y++) {
        if (y !== 0) {
          for (let z = -1; z <= 1; z++) {
            if (z !== 0) {
              result.push([x, y, z]);
            }
          }
        }
      }
    }
  }
  return result;
})();

const dataSymbol = Symbol();

class Tools {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, pose, input, render, teleport, items} = zeo;
    const {THREE, scene, camera} = three;

    const forwardVector = new THREE.Vector3(0, 0, -1);
    const dotMeshBaseQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 8, 0, 0, camera.rotation.order));

    const polygonMeshMaterial = new THREE.MeshPhongMaterial({
      color: 0x9E9E9E,
      shininess: 0,
      shading: THREE.FlatShading,
    });

    const _makeWorkerPromise = () => {
      const worker = new Worker('archae/plugins/_plugins_tools/build/worker.js');
      const queue = [];
      worker.requestMesh = (x, y, z, points, resultBuffer) => new Promise((accept, reject) => {
        worker.postMessage({
          x,
          y,
          z,
          points,
          resultBuffer,
        }, [resultBuffer]);
        queue.push(data => {
          accept(data);
        });
      })
        .then(({resultBuffer}) => {
          const {positions, unindexedPositions, normals, indices} = protocolUtils.parseGeometry(resultBuffer);
          return {resultBuffer, positions, unindexedPositions, normals, indices};
        });
      worker.onmessage = e => {
        const {data} = e;
        const cb = queue.shift();
        cb(data);
      };
      return Promise.resolve(worker);
    };

    let worker = null;
    let workerPromise = null;
    const _requestWorker = () => {
      if (!workerPromise) {
        workerPromise = _makeWorkerPromise()
          .then(newWorker => {
            worker = newWorker;

            return Promise.resolve(newWorker);
          })
          .catch(err => {
             workerPromise = null;

            return Promise.reject(err);
          });
      }
      return workerPromise;
    };

    const itemApi = {
      asset: 'HAMMER',
      itemAddedCallback(grabbable) {
        const polygonMeshes = {};

        const _makePolygonMesh = (ox, oy, oz) => {
          const geometry = new THREE.BufferGeometry();
          geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3((ox + 0.5) * RESOLUTION, (oy + 0.5) * RESOLUTION, (oz + 0.5) * RESOLUTION),
            Math.sqrt(RESOLUTION * RESOLUTION * 3)
          );

          const material = polygonMeshMaterial;

          const mesh = new THREE.Mesh(geometry, material);

          const buffers = [
            new ArrayBuffer(BUFFER_SIZE),
            new ArrayBuffer(BUFFER_SIZE),
          ];
          let bufferPage = 0;
          let refreshPromise = null;
          let queued = false;
          let teleportMesh = null;

          const points = new Float32Array((RESOLUTION + 1) * (RESOLUTION + 1) * (RESOLUTION + 1));
          mesh.points = points;
          mesh.update = () => {
            const _recurse = () => {
              if (!refreshPromise) {
                const buffer = buffers[bufferPage];
                refreshPromise = worker.requestMesh(ox, oy, oz, points, buffer);
                refreshPromise
                  .then(({resultBuffer, positions, unindexedPositions, normals, indices}) => {
                    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                    geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
                    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

                    if (!mesh.visible) {
                      mesh.visible = true;
                    }

                    buffers[bufferPage] = resultBuffer;
                    bufferPage = bufferPage === 0 ? 1 : 0;
                    refreshPromise = null;

                    if (teleportMesh) {
                      teleport.removeTarget(teleportMesh);
                      teleportMesh.destroy();
                    }
                    teleportMesh = (() => {
                      const geometry = new THREE.BufferGeometry();
                      geometry.addAttribute('position', new THREE.BufferAttribute(unindexedPositions, 3));
                      const material = polygonMeshMaterial;
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.destroy = () => {
                        geometry.dispose();
                      };
                      return mesh;
                    })();
                    teleport.addTarget(teleportMesh, {
                      flat: true,
                    });
                    teleport.reindex();

                    if (queued) {
                      queued = false;

                      _recurse();
                    }
                  }).catch(err => {
                    console.warn(err);

                    refreshPromise = null;
                  });
              } else {
                queued = true;
              }
            };
            _recurse();
          };
          mesh.destroy = () => {
            geometry.dispose();
          };

          mesh.visible = false;

          return mesh;
        };

        const _logPoint = p => {
          const polygonMeshesToUpdate = [];

          const baseValue = Math.sqrt(Math.pow(1.25, 2) * 3);
          for (let dz = -1; dz <= 1; dz++) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const x = Math.floor(p.x + dx);
                const y = Math.floor(p.y + dy);
                const z = Math.floor(p.z + dz);
                const v = Math.max(baseValue - Math.sqrt(dx*dx + dy*dy + dz*dz), 0);

                const pointPolygonMeshesToUpdate = [];

                for (let i = 0; i < DIRECTIONS.length; i++) {
                  const direction = DIRECTIONS[i];
                  const [ex, ey, ez] = direction;

                  const lx = x + ex;
                  const ly = y + ey;
                  const lz = z + ez;

                  const ox = Math.floor(lx / RESOLUTION);
                  const oy = Math.floor(ly / RESOLUTION);
                  const oz = Math.floor(lz / RESOLUTION);

                  const rx = x - (ox * RESOLUTION);
                  const ry = y - (oy * RESOLUTION);
                  const rz = z - (oz * RESOLUTION);

                  if (rx >= 0 && rx <= RESOLUTION && ry >= 0 && ry <= RESOLUTION && rz >= 0 && rz <= RESOLUTION) {
                    const meshIndex = ox + ':' + oy + ':' + oz;
                    let polygonMesh = polygonMeshes[meshIndex];
                    if (!polygonMesh) {
                      polygonMesh = _makePolygonMesh(ox, oy, oz);
                      scene.add(polygonMesh);
                      polygonMeshes[meshIndex] = polygonMesh;
                    }
                    if (!pointPolygonMeshesToUpdate.includes(polygonMesh)) {
                      const {points} = polygonMesh;
                      const pointIndex = rx + (ry * (RESOLUTION + 1)) + (rz * (RESOLUTION + 1) * (RESOLUTION + 1));
                      points[pointIndex] = Math.max(v, points[pointIndex]);

                      pointPolygonMeshesToUpdate.push(polygonMesh);
                    }
                  }
                }
                polygonMeshesToUpdate.push.apply(polygonMeshesToUpdate, pointPolygonMeshesToUpdate);
              }
            }
          }

          if (polygonMeshesToUpdate.length > 0) {
            for (let i = 0; i < polygonMeshesToUpdate.length; i++) {
              const polygonMesh = polygonMeshesToUpdate[i];
              polygonMesh.update();
            }
          }
        };

        const dotMesh = (() => {
          const geometry = new THREE.ConeBufferGeometry(0.5, 0.5, 3, 1);
          const material = polygonMeshMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;

          mesh.destroy = () => {
            geometry.dispose();
          };

          return mesh;
        })();
        scene.add(dotMesh);

        let grabbed = false;
        let drawing = false;
        const _triggerdown = e => {
          if (grabbed) {
            drawing = true;

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerdown', _triggerdown);
        const _triggerup = e => {
          if (drawing) {
            drawing = false;

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerup', _triggerup);
        const _grab = e => {
          grabbed = true;

          dotMesh.visible = true;
        };
        grabbable.on('grab', _grab);
        const _release = e => {
          grabbed = false;
          drawing = false;

          dotMesh.visible = false;
        };
        grabbable.on('release', _release);

        const _update = () => {
          const _updateDotMesh = () => {
            if (dotMesh.visible) {
              const grabbablePosition = new THREE.Vector3().fromArray(grabbable.position);
              const grabbableRotation = new THREE.Quaternion().fromArray(grabbable.rotation);
              const grabbableScale = new THREE.Vector3(1, 1, 1).fromArray(grabbable.scale);

              const position = grabbablePosition.clone()
                .add(
                  forwardVector.clone()
                    .multiplyScalar(5)
                    .applyQuaternion(grabbableRotation)
                );
              dotMesh.position.copy(position);
              dotMesh.quaternion.copy(grabbableRotation.clone().multiply(dotMeshBaseQuaternion));
              dotMesh.updateMatrixWorld();
            }
          };
          const _draw = () => {
            if (drawing) {
              const {position} = dotMesh;
              _logPoint(position);
            }
          };

          _updateDotMesh();
          _draw();
        };
        render.on('update', _update);

        const _cleanup = () => {
          for (const k in polygonMeshes) {
            const polygonMesh = polygonMeshes[k];
            scene.remove(polygonMesh);
            polygonMesh.destroy();
          }

          scene.remove(dotMesh);

          input.removeListener('triggerdown', _triggerdown);
          input.removeListener('triggerup', _triggerup);

          grabbable.removeListener('grab', _grab);
          grabbable.removeListener('release', _release);

          render.removeListener('update', _update);
        };

        grabbable[dataSymbol] = {
          cleanup: _cleanup,
        };
      },
      itemRemovedCallback(grabbable) {
        const {[dataSymbol]: {cleanup}} = grabbable;

        cleanup();

        delete grabbable[dataSymbol];
      },
    };
    items.registerItem(this, itemApi);

    const itemRecipe = {
      output: 'HAMMER',
      width: 2,
      height: 3,
      input: [
        'STONE', 'STONE',
        null, 'WOOD',
        null, 'WOOD',
      ],
    };
    items.registerRecipe(this, itemRecipe);

    this._cleanup = () => {
      items.unregisterItem(this, itemApi);
      items.unregisterRecipe(this, itemRecipe);

      if (worker !== null) {
        worker.terminate();
      }
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tools;
