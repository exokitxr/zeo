const TELEPORT_DISTANCE = 15;
const DEFAULT_USER_HEIGHT = 1.6;

const SIDES = ['left', 'right'];

class Teleport {
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
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/cyborg',
    ]).then(([
      zeo,
      input,
      webvr,
      cyborg,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;
        const world = zeo.getCurrentWorld();

        const teleportMeshMaterial = new THREE.MeshBasicMaterial({
          color: 0x000000,
          wireframe: true,
          opacity: 0.25,
          transparent: true,
        });

        const floorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));

        const _makeTeleportMesh = () => {
          const geometry = new THREE.TorusBufferGeometry(0.5, 0.1, 3, 5, Math.PI * 2);
          geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
          geometry.applyMatrix(new THREE.Matrix4().makeRotationY((1 / 20) * (Math.PI * 2)));

          const material = teleportMeshMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;
          return mesh;
        };

        const teleportMeshes = {
          left: _makeTeleportMesh(),
          right: _makeTeleportMesh(),
        };
        scene.add(teleportMeshes.left);
        scene.add(teleportMeshes.right);

        const _makeTeleportState = () => ({
          teleportFloorPoint: null,
          teleportAirPoint: null,
        });
        const teleportStates = {
          left: _makeTeleportState(),
          right: _makeTeleportState(),
        };

        /* const paddown = e => {
          const {side} = e;
          const teleportState = teleportStates[side];

          const status = webvr.getStatus();
          const {gamepads} = status;
          const gamepadStatus = gamepads[side];
        };
        input.addEventListener('paddown', paddown);
        const padup = e => {
          const {side} = e;
          const teleportState = teleportStates[side];
          // XXX
        };
        input.addEventListener('padup', padup);

        this._cleanup = () => {
          input.removeEventListener('keydown', keydown);
          input.removeEventListener('keyup', keyup);
        }; */

        this._cleanup = () => {};

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, quaternion, scale);
          return {
            position,
            quaternion,
            scale,
          };
        };

        const _update = options => {
          const status = webvr.getStatus();
          const {gamepads} = status;

          SIDES.forEach(side => {
            const gamepadStatus = gamepads[side];
            const teleportState = teleportStates[side];
            const teleportMesh = teleportMeshes[side];

            if (gamepadStatus) {
              const {position: controllerPosition, rotation: controllerRotation, buttons} = gamepadStatus;
              const padButtonPressed = buttons.pad.pressed;

              if (padButtonPressed) {
                const ray = new THREE.Vector3(0, 0, -10)
                  .applyQuaternion(controllerRotation);
                const controllerLine = new THREE.Line3(
                  controllerPosition.clone(),
                  controllerPosition.clone().add(ray.clone().multiplyScalar(15))
                );
                const intersectionPoint = floorPlane.intersectLine(controllerLine);

                if (intersectionPoint) {
                  teleportMesh.position.copy(intersectionPoint);

                  const controllerEuler = new THREE.Euler().setFromQuaternion(controllerRotation, camera.rotation.order);
                  teleportMesh.rotation.y = controllerEuler.y;

                  teleportState.teleportFloorPoint = intersectionPoint;

                  if (!teleportMesh.visible) {
                    teleportMesh.visible = true;
                  }
                } else {
                  teleportState.teleportFloorPoint = null;

                  if (teleportMesh.visible) {
                    teleportMesh.visible = false;
                  }
                }
              } else {
                const {teleportFloorPoint} = teleportState;

                if (teleportFloorPoint) {
                  const destinationPoint = teleportFloorPoint.clone().add(new THREE.Vector3(0, DEFAULT_USER_HEIGHT, 0));
                  const {position: cameraPosition} = _decomposeObjectMatrixWorld(camera);
                  const positionDiff = destinationPoint.clone().sub(cameraPosition);

                  const stageMatrix = webvr.getStageMatrix();
                  const {position, quaternion, scale} = _decomposeMatrix(stageMatrix);
                  position.add(positionDiff);
                  stageMatrix.compose(position, quaternion, scale);
                  webvr.setStageMatrix(stageMatrix);

                  webvr.updateStatus();
                  cyborg.update();

                  teleportState.teleportFloorPoint = null;
                }

                if (teleportMesh.visible) {
                  teleportMesh.visible = false;
                }
              }
            }
          });
        };

        return {
          update: _update,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Teleport;
