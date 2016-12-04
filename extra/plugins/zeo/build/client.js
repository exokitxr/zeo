// import {RESOURCES} from '../../Resources';

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

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE} = zeo;
        const world = zeo.getCurrentWorld();

        const polygonMeshMaterial = new THREE.MeshPhongMaterial({
          color: 0xFF0000,
          shininess: 0,
          shading: THREE.FlatShading,
        });

        return world.requestWorker(this)
          .then(worker => {
            worker.request('ping', [ 'lol' ])
              .then(response => {
                console.log('build plugin got response', {response});

                worker.terminate();
              })
              .catch(err => {
                console.warn(err);
              });
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

/* class Build {
  constructor({scene, controllers}) {
    this._scene = scene;
    this._controllers = controllers;

    let originPoint = null;
    let points = null;

    const polygonMesh = (() => {
      const geometry = new THREE.BufferGeometry();

      const material = polygonMeshMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false; // XXX compute bounding box instead
      return mesh;
    })();
    scene.add(polygonMesh);
    this.polygonMesh = polygonMesh;

    let mode = 'move';
    let brushSize = 2;

    let interval = null;
    const _getPointIndex = point => (point.x * chunkSize * chunkSize) + (point.y * chunkSize) + point.z;
    const _getCurrentPoint = () => {
      const mesh = (() => {
        if (mode === 'left') {
          return controllers.left.mesh.inner;
        } else if (mode ==='right') {
          return controllers.right.mesh.inner;
        } else {
          return null;
        }
      })();

      if (mesh) {
        const {position} = _getMatrix(mesh);
        return position;
      } else {
        return null;
      }
    };
    const _logPoint = () => {
      const currentPoint = _getCurrentPoint();

      if (currentPoint) {
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
          originPoint.z - ((chunkSize / 2) * polygonMeshResolution),
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

        _refreshPolygonMesh();
      }
    }
    let refreshPromise = null;
    const _refreshPolygonMesh = () => {
      if (refreshPromise) {
        refreshPromise.cancel();
        refreshPromise = null;
      }

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
      refreshPromise = RESOURCES.ASYNC_THREAD_POOL.marchCubes({
        points,
        chunkSize,
        dims,
        start,
        end,
      });
      refreshPromise.then(({positions}) => {
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
      }).catch(err => {
        console.warn(err);
      });
    };
    const _startBuilding = () => {
      if (!interval) {
        originPoint = _getCurrentPoint();
        points = new Float32Array(chunkSize * chunkSize * chunkSize);

        const _recurse = () => {
          _logPoint();
          interval = requestAnimationFrame(_recurse);
        };
        _recurse();
      }
    };
    const _stopBuilding = () => {
      if (interval) {
        cancelAnimationFrame(interval);

        interval = null;
      }
    };

    window.addEventListener('keydown', e => {
      if (window.document.pointerLockElement) {
        switch (e.keyCode) {
          case 90: // Z
            mode = 'left';
            break;
          case 88: // X
            mode = 'move';
            break;
          case 67: // C
            mode = 'right';
            break;
          case 69: // E
            _startBuilding();
            break;
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
      }
    });
    window.addEventListener('keyup', e => {
      if (window.document.pointerLockElement) {
        switch (e.keyCode) {
          case 69: // E
            _stopBuilding();
            break;
        }
      }
    });
    window.document.addEventListener('pointerlockchange', e => {
      if (!window.document.pointerLockElement) {
        _stopBuilding();
      }
    });
  }

  update() {
    // XXX
  }
};

const _getMatrix = object => {
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  object.updateMatrixWorld();
  object.matrixWorld.decompose(position, rotation, scale);

  return {
    position,
    rotation,
    scale,
  };
}; */

module.exports = Build;
