const polygonMeshResolution = 0.02;
const chunkSize = 8;
const h = chunkSize / 2;

class Build {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/zeo',
      '/core/engines/webvr',
      '/core/engines/input',
    ]).then(([
      zeo,
      webvr,
      input,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;
        const world = zeo.getCurrentWorld();

        return world.requestWorker(this, {
          count: 2,
        })
          .then(worker => {
            if (live) {
              const polygonMeshMaterial = new THREE.MeshPhongMaterial({
                color: 0xFF0000,
                shininess: 0,
                shading: THREE.FlatShading,
              });

              const _getMatrix = object => {
                const position = new THREE.Vector3();
                const rotation = new THREE.Quaternion();
                const scale = new THREE.Vector3();
                // object.updateMatrixWorld();
                object.matrixWorld.decompose(position, rotation, scale);

                return {
                  position,
                  rotation,
                  scale,
                };
              };

              // main
              const _makeBuildState = () => ({
                originPoint: null,
                points: null,
                interval: null,
                refreshPromise: null,
              });
              const buildStates = {
                left: _makeBuildState(),
                right: _makeBuildState(),
              };

              let brushSize = 2;

              const _makePolygonMesh = () => {
                const geometry = new THREE.BufferGeometry();

                const material = polygonMeshMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.visible = false;
                mesh.frustumCulled = false; // XXX compute bounding box instead
                return mesh;
              };
              const polygonMeshes = {
                left: _makePolygonMesh(),
                right: _makePolygonMesh(),
              };
              scene.add(polygonMeshes.left);
              scene.add(polygonMeshes.right);

              const _getPointIndex = point => (point.x * chunkSize * chunkSize) + (point.y * chunkSize) + point.z;
              const _getCurrentPoint = side => {
                const status = webvr.getStatus();
                const {gamepads} = status;
                const gamepadStatus = gamepads[side];
                if (gamepadStatus) {
                  const {position: controllerPosition} = gamepadStatus;
                  return controllerPosition.clone();
                } else {
                  return null;
                }
              };
              const _logPoint = side => {
                const currentPoint = _getCurrentPoint(side);

                if (currentPoint) {
                  const buildState = buildStates[side];
                  const {originPoint, points} = buildState;

                  const _setPoint = (point, v) => {
                    const pointIndex = _getPointIndex(point);
                    points[pointIndex] = Math.max(v, points[pointIndex]);
                  };
                  const _makePointValue = (() => {
                    if (brushSize === 1) {
                      return (dx, dy, dz) => {
                        if (dx === 0 && dy === 0 && dz === 0) {
                          return 1;
                        } else {
                          return 0.4;
                        }
                      };
                    } else if (brushSize === 2) {
                      return (dx, dy, dz) => {
                        if (dx === 0 && dy === 0 && dz === 0) {
                          return 1;
                        } else if (!((dx === 1 || dx === -1) && (dy === 1 || dy === -1) && (dz === 1 || dz === -1))) {
                          return 0.5;
                        } else {
                          return 0.25;
                        }
                      };
                    } else {
                      return (dx, dy, dz) => {
                        const distance = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
                        if (distance === 0) {
                          return 1;
                        } else if (distance <= 1) {
                          return 0.75;
                        } else if (distance <= 2) {
                          return 0.5;
                        } else {
                          return 0.25;
                        }
                      };
                    }
                  })();

                  const minPoint = new THREE.Vector3(
                    originPoint.x - ((chunkSize / 2) * polygonMeshResolution),
                    originPoint.y - ((chunkSize / 2) * polygonMeshResolution),
                    originPoint.z - ((chunkSize / 2) * polygonMeshResolution)
                  );

                  if (brushSize !== 3) {
                    for (let dx = -1; dx <= 1; dx++) {
                      for (let dy = -1; dy <= 1; dy++) {
                        for (let dz = -1; dz <= 1; dz++) {
                          const point = new THREE.Vector3(
                            Math.floor(((currentPoint.x + (dx * polygonMeshResolution)) - minPoint.x) / polygonMeshResolution),
                            Math.floor(((currentPoint.y + (dy * polygonMeshResolution)) - minPoint.y) / polygonMeshResolution),
                            Math.floor(((currentPoint.z + (dz * polygonMeshResolution)) - minPoint.z) / polygonMeshResolution)
                          );
                          if (point.x >= 0 && point.x < chunkSize && point.y >= 0 && point.y < chunkSize && point.z >= 0 && point.z < chunkSize) {
                            const v = _makePointValue(dx, dy, dz);
                            _setPoint(point, v);
                          }
                        }
                      }
                    }
                  } else {
                    for (let dx = -2; dx <= 2; dx++) {
                      for (let dy = -2; dy <= 2; dy++) {
                        for (let dz = -2; dz <= 2; dz++) {
                          const point = new THREE.Vector3(
                            Math.floor(((currentPoint.x + (dx * polygonMeshResolution)) - minPoint.x) / polygonMeshResolution),
                            Math.floor(((currentPoint.y + (dy * polygonMeshResolution)) - minPoint.y) / polygonMeshResolution),
                            Math.floor(((currentPoint.z + (dz * polygonMeshResolution)) - minPoint.z) / polygonMeshResolution)
                          );
                          if (point.x >= 0 && point.x < chunkSize && point.y >= 0 && point.y < chunkSize && point.z >= 0 && point.z < chunkSize) {
                            const v = _makePointValue(dx, dy, dz);
                            _setPoint(point, v);
                          }
                        }
                      }
                    }
                  }

                  _refreshPolygonMesh(side);
                }
              }
              const _refreshPolygonMesh = side => {
                const buildState = buildStates[side];
                const {refreshPromise} = buildState;

                if (!refreshPromise) {
                  const {originPoint, points} = buildState;
                  const polygonMesh = polygonMeshes[side];
                  const {geometry: polygonMeshGeometry} = polygonMesh;

                  const startX = -h - 1;
                  const startY = -h - 1;
                  const startZ = -h - 1;

                  const endX = h + 1;
                  const endY = h + 1;
                  const endZ = h + 1;

                  const minX = originPoint.x + (startX * polygonMeshResolution);
                  const minY = originPoint.y + (startY * polygonMeshResolution);
                  const minZ = originPoint.z + (startZ * polygonMeshResolution);

                  const dims = [ endX - startX, endY - startY, endZ - startZ ];
                  const start = [ startX, startY, startZ ];
                  const end = [ endX, endY, endZ ];
                  buildState.refreshPromise = worker.request('marchCubes', [
                    {
                      points,
                      chunkSize,
                      dims,
                      start,
                      end,
                    },
                  ]);
                  buildState.refreshPromise.then(({positions}) => {
                    // offset positions to the local reference frame
                    const numPoints = positions.length / 3;
                    for (let i = 0; i < numPoints; i++) {
                      const baseIndex = i * 3;

                      positions[baseIndex + 0] = minX + ((positions[baseIndex + 0] - startX) * polygonMeshResolution);
                      positions[baseIndex + 1] = minY + ((positions[baseIndex + 1] - startY) * polygonMeshResolution);
                      positions[baseIndex + 2] = minZ + ((positions[baseIndex + 2] - startZ) * polygonMeshResolution);
                    }

                    polygonMeshGeometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                    polygonMeshGeometry.removeAttribute('normal');
                    polygonMeshGeometry.computeVertexNormals();
                    if (!polygonMesh.visible) {
                      polygonMesh.visible = true;
                    }

                    buildState.refreshPromise = null;
                  }).catch(err => {
                    console.warn(err);

                    buildState.refreshPromise = null;
                  });
                }
              };
              const _startBuilding = side => {
                const buildState = buildStates[side];
                const {interval} = buildState;

                if (!interval) {
                  buildState.originPoint = _getCurrentPoint(side);
                  buildState.points = new Float32Array(chunkSize * chunkSize * chunkSize);

                  const _recurse = () => {
                    _logPoint(side);

                    buildState.interval = requestAnimationFrame(_recurse);
                  };
                  _recurse();
                }
              };
              const _stopBuilding = side => {
                const buildState = buildStates[side];
                const {interval} = buildState;

                if (interval) {
                  cancelAnimationFrame(interval);

                  buildState.interval = null;
                }
              };

              const keydown = e => {
                switch (e.keyCode) {
                  case 49: // 1
                    brushSize = 1;
                    break;
                  case 50: // 2
                    brushSize = 2;
                    break;
                  case 51: // 3
                    brushSize = 3;
                    break;
                }
              };
              input.addEventListener('keydown', keydown);
              const triggerdown = e => {
                const {side} = e;

                _startBuilding(side);
              };
              input.addEventListener('triggerdown', triggerdown);
              const triggerup = e => {
                const {side} = e;

                _stopBuilding(side);
              };
              input.addEventListener('triggerup', triggerup);

              this._cleanup = () => {
                scene.remove(polygonMeshes.left);
                scene.remove(polygonMeshes.right);

                input.removeEventListener('keydown', keydown);
                input.removeEventListener('triggerdown', triggerdown);
                input.removeEventListener('triggerup', triggerup);

                worker.terminate();
              };
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

module.exports = Build;
