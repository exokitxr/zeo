const TELEPORT_DISTANCE = 15;

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

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/input',
      '/core/engines/rend',
      '/core/engines/cyborg',
    ]).then(([
      three,
      webvr,
      input,
      rend,
      cyborg,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

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

        const teleportMeshMaterial = new THREE.MeshPhongMaterial({
          color: 0xFFC107,
          shading: THREE.FlatShading,
          opacity: 0.5,
          transparent: true,
        });

        const floorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));

        const _makeTeleportFloorMesh = () => {
          const geometry = new THREE.TorusBufferGeometry(0.5, 0.15, 3, 5);
          geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
          geometry.applyMatrix(new THREE.Matrix4().makeRotationY((1 / 20) * (Math.PI * 2)));

          const material = teleportMeshMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;
          return mesh;
        };
        const teleportFloorMeshes = {
          left: _makeTeleportFloorMesh(),
          right: _makeTeleportFloorMesh(),
        };
        scene.add(teleportFloorMeshes.left);
        scene.add(teleportFloorMeshes.right);

        const _makeTeleportAirMesh = () => {
          const geometry = new THREE.BoxBufferGeometry(1, 1, 1);

          const material = teleportMeshMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;
          return mesh;
        };
        const teleportAirMeshes = {
          left: _makeTeleportAirMesh(),
          right: _makeTeleportAirMesh(),
        };
        scene.add(teleportAirMeshes.left);
        scene.add(teleportAirMeshes.right);

        const _makeTeleportState = () => ({
          teleporting: false,
          teleportFloorPoint: null,
          teleportAirPoint: null,
        });
        const teleportStates = {
          left: _makeTeleportState(),
          right: _makeTeleportState(),
        };

        let airHeight = 0;

        const _paddown = e => {
          const {side} = e;

          const teleportState = teleportStates[side];
          teleportState.teleporting = true;
        };
        input.on('paddown', _paddown);
        const _padup = e => {
          const {side} = e;

          const teleportState = teleportStates[side];
          teleportState.teleporting = false;
        };
        input.on('padup', _padup);

        const _update = () => {
          const status = webvr.getStatus();
          const {hmd, gamepads} = status;
          const {position: hmdPosition, rotation: hmdRotation, scale: hmdScale} = hmd;
          const hmdAbsPosition = hmdPosition.clone().multiply(hmdScale);

          SIDES.forEach(side => {
            const gamepad = gamepads[side];

            if (gamepad) {
              const teleportState = teleportStates[side];
              const {teleporting} = teleportState;
              const teleportFloorMesh = teleportFloorMeshes[side];
              const teleportAirMesh = teleportAirMeshes[side];

              if (teleporting) {
                const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale, axes} = gamepad;

                const controllerAbsPosition = controllerPosition.clone().multiply(controllerScale);
                const ray = new THREE.Vector3(0, 0, -1)
                  .applyQuaternion(controllerRotation);
                const axisFactor = (axes[1] - (-1)) / 2;
                const controllerLine = new THREE.Line3(
                  controllerAbsPosition.clone(),
                  controllerAbsPosition.clone().add(ray.clone().multiplyScalar(axisFactor * TELEPORT_DISTANCE))
                );
                const intersectionPoint = floorPlane.intersectLine(controllerLine);

                if (intersectionPoint) {
                  const destinationPoint = intersectionPoint;
                  teleportFloorMesh.position.copy(destinationPoint);
                  const controllerEuler = new THREE.Euler().setFromQuaternion(controllerRotation, camera.rotation.order);
                  teleportFloorMesh.rotation.y = controllerEuler.y;

                  teleportState.teleportFloorPoint = destinationPoint;
                  teleportState.teleportAirPoint = null;

                  if (!teleportFloorMesh.visible) {
                    teleportFloorMesh.visible = true;
                  }
                  if (teleportAirMesh.visible) {
                    teleportAirMesh.visible = false;
                  }
                } else {
                  const destinationPoint = controllerLine.end.clone();
                  destinationPoint.y = Math.max(destinationPoint.y, hmdAbsPosition.y - airHeight, 0);
                  teleportAirMesh.position.copy(destinationPoint);
                  const controllerEuler = new THREE.Euler().setFromQuaternion(controllerRotation, camera.rotation.order);
                  teleportAirMesh.rotation.y = controllerEuler.y;

                  teleportState.teleportAirPoint = destinationPoint;
                  teleportState.teleportFloorPoint = null;

                  if (!teleportAirMesh.visible) {
                    teleportAirMesh.visible = true;
                  }
                  if (teleportFloorMesh.visible) {
                    teleportFloorMesh.visible = false;
                  }
                }
              } else {
                const {teleportFloorPoint, teleportAirPoint} = teleportState;

                if (teleportFloorPoint) {
                  const destinationPoint = teleportFloorPoint.clone().add(new THREE.Vector3(0, hmdAbsPosition.y - airHeight, 0));
                  const positionAbsDiff = destinationPoint.clone().sub(hmdAbsPosition);
                  const positionDiff = positionAbsDiff.clone().divide(hmdScale);

                  airHeight = 0;

                  const stageMatrix = webvr.getStageMatrix();
                  const {position, quaternion, scale} = _decomposeMatrix(stageMatrix);
                  position.add(positionDiff);
                  stageMatrix.compose(position, quaternion, scale);
                  webvr.setStageMatrix(stageMatrix);

                  webvr.updateStatus();
                  webvr.updateUserStageMatrix();
                  cyborg.update();

                  teleportState.teleportFloorPoint = null;
                } else if (teleportAirPoint) {
                  const destinationPoint = teleportAirPoint.clone();
                  const positionAbsDiff = destinationPoint.clone().sub(hmdAbsPosition);
                  const positionDiff = positionAbsDiff.clone().divide(hmdScale);

                  airHeight += destinationPoint.y - hmdAbsPosition.y;

                  const stageMatrix = webvr.getStageMatrix();
                  const {position, quaternion, scale} = _decomposeMatrix(stageMatrix);
                  position.add(positionDiff);
                  stageMatrix.compose(position, quaternion, scale);
                  webvr.setStageMatrix(stageMatrix);

                  webvr.updateStatus();
                  webvr.updateUserStageMatrix();
                  cyborg.update();

                  teleportState.teleportAirPoint = null;
                }

                if (teleportFloorMesh.visible) {
                  teleportFloorMesh.visible = false;
                }
                if (teleportAirMesh.visible) {
                  teleportAirMesh.visible = false;
                }
              }
            }
          });
        };
        rend.on('update', _update);

        this._cleanup = () => {
          SIDES.forEach(side => {
            scene.remove(teleportFloorMeshes[side]);
            scene.remove(teleportAirMeshes[side]);
          });

          input.removeListener('paddown', _paddown);
          input.removeListener('padup', _padup);

          rend.removeListener('update', _update);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Teleport;
