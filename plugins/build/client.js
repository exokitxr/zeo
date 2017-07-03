const protocolUtils = require('./lib/utils/protocol-utils');

const RESOLUTION = 32;
const BUFFER_SIZE = 100 * 1024;

class Build {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, pose, input} = zeo;
    const {THREE, scene} = three;

    const polygonMeshMaterial = new THREE.MeshPhongMaterial({
      color: 0x9E9E9E,
      shininess: 0,
      shading: THREE.FlatShading,
    });

    const worker = new Worker('archae/plugins/_plugins_build/build/worker.js');
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
        const {positions, normals, indices} = protocolUtils.parseGeometry(resultBuffer);
        return {resultBuffer, positions, normals, indices};
      });
    worker.onmessage = e => {
      const {data} = e;
      const cb = queue.shift();
      cb(data);
    };

    const _makeBuildState = () => ({
      originPoint: null,
      points: null,
      resultBuffers: [
        new ArrayBuffer(BUFFER_SIZE),
        new ArrayBuffer(BUFFER_SIZE),
      ],
      resultBufferPage: 0,
      interval: null,
      refreshPromise: null,
      queued: false,
    });
    const buildStates = {
      left: _makeBuildState(),
      right: _makeBuildState(),
    };

    let brushSize = 2;

    const _makePolygonMesh = () => {
      const geometry = new THREE.BufferGeometry();
      geometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(),
        1
      );

      const material = polygonMeshMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false; // XXX
      return mesh;
    };
    const polygonMeshes = {
      left: _makePolygonMesh(),
      right: _makePolygonMesh(),
    };
    scene.add(polygonMeshes.left);
    scene.add(polygonMeshes.right);

    const _logPoint = side => {
      const buildState = buildStates[side];

      const _setPointsData = () => {
        let updated = false;

        const {gamepads} = pose.getStatus();
        const gamepad = gamepads[side];
        const {worldPosition: controllerPosition} = gamepad;
        const {originPoint, points} = buildState;

        const baseX = Math.floor((controllerPosition.x - originPoint.x + 0.5) * RESOLUTION);
        const baseY = Math.floor((controllerPosition.y - originPoint.y + 0.5) * RESOLUTION);
        const baseZ = Math.floor((controllerPosition.z - originPoint.z + 0.5) * RESOLUTION);
        const baseValue = Math.sqrt(Math.pow(1.25, 2) * 3);
        for (let dz = -1; dz <= 1; dz++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const x = baseX + dx;
              const y = baseY + dy;
              const z = baseZ + dz;

              if (x >= 0 && x < RESOLUTION && y >= 0 && y < RESOLUTION && z >= 0 && z < RESOLUTION) {
                const pointIndex = x + (y * RESOLUTION) + (z * RESOLUTION * RESOLUTION);
                const v = Math.max(baseValue - Math.sqrt(dx*dx + dy*dy + dz*dz), 0);
                points[pointIndex] = Math.max(v, points[pointIndex]);

                updated = true;
              }
            }
          }
        }

        return updated;
      };

      const updated = _setPointsData();
      if (updated) {
        _refreshPolygonMesh(side);
      }
    };
    const _refreshPolygonMesh = side => {
      const _recurse = () => {
        const buildState = buildStates[side];
        const {refreshPromise} = buildState;

        if (!refreshPromise) {
          const {originPoint, points, resultBuffers, resultBufferPage} = buildState;
          const resultBuffer = resultBuffers[resultBufferPage];
          const refreshPromise = worker.requestMesh(originPoint.x, originPoint.y, originPoint.z, points, resultBuffer);
          refreshPromise
            .then(({resultBuffer, positions, normals, indices}) => {
              const polygonMesh = polygonMeshes[side];
              const {geometry} = polygonMesh;
              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
              geometry.setIndex(new THREE.BufferAttribute(indices, 1));

              if (!polygonMesh.visible) {
                polygonMesh.visible = true;
              }

              buildState.resultBuffers[resultBufferPage] = resultBuffer;
              buildState.resultBufferPage = resultBufferPage === 0 ? 1 : 0;
              buildState.refreshPromise = null;

              const {queued} = buildState;
              if (queued) {
                buildState.queued = false;

                _recurse();
              }
            }).catch(err => {
              console.warn(err);

              buildState.refreshPromise = null;
            });
          buildState.refreshPromise = refreshPromise;
        } else {
          buildState.queued = true;
        }
      };
      _recurse();
    };
    const _startBuilding = side => {
      const buildState = buildStates[side];
      const {interval} = buildState;

      if (!interval) {
        const {gamepads} = pose.getStatus();
        const gamepad = gamepads[side];
        const {worldPosition: controllerPosition} = gamepad;
        buildState.originPoint = controllerPosition.clone();
        buildState.points = new Float32Array(RESOLUTION * RESOLUTION * RESOLUTION);

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
    input.on('keydown', keydown);
    const triggerdown = e => {
      const {side} = e;

      _startBuilding(side);
    };
    input.on('triggerdown', triggerdown);
    const triggerup = e => {
      const {side} = e;

      _stopBuilding(side);
    };
    input.on('triggerup', triggerup);

    this._cleanup = () => {
      scene.remove(polygonMeshes.left);
      scene.remove(polygonMeshes.right);

      input.removeListener('keydown', keydown);
      input.removeListener('triggerdown', triggerdown);
      input.removeListener('triggerup', triggerup);

      worker.terminate();
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Build;
