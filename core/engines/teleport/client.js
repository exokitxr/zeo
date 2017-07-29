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
      '/core/engines/bootstrap',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/input',
      '/core/engines/rend',
      '/core/engines/cyborg',
      '/core/utils/js-utils',
    ]).then(([
      bootstrap,
      three,
      webvr,
      input,
      rend,
      cyborg,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        /* const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        }; */

        const forwardVector = new THREE.Vector3(0, 0, -1);
        const localVector = new THREE.Vector3();
        const localVector2 = new THREE.Vector3();
        const localEuler = new THREE.Euler();
        const localMatrix = new THREE.Matrix4();
        const localMatrix2 = new THREE.Matrix4();

        const teleportMeshMaterial = new THREE.MeshPhongMaterial({
          color: 0xF44336,
          shading: THREE.FlatShading,
          // opacity: 0.5,
          // transparent: true,
        });

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
        });
        const teleportStates = {
          left: _makeTeleportState(),
          right: _makeTeleportState(),
        };

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

        const targets = [];

        const _update = () => {
          const {hmd, gamepads} = webvr.getStatus();
          const {position: hmdLocalPosition, rotation: hmdLocalRotation} = hmd;

          for (let i = 0; i < SIDES.length; i++) {
            const side = SIDES[i];
            const teleportState = teleportStates[side];
            const {teleporting} = teleportState;
            const gamepad = gamepads[side];
            const teleportFloorMesh = teleportFloorMeshes[side];
            const teleportAirMesh = teleportAirMeshes[side];

            if (teleporting) {
              const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;

              let targetPosition = null;
              for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                const tp = target(controllerPosition, controllerRotation, controllerScale);
                if (tp) {
                  targetPosition = tp;
                  break;
                }
              }

              if (targetPosition) {
                teleportFloorMesh.position.copy(targetPosition);
                teleportFloorMesh.rotation.setFromQuaternion(controllerRotation, camera.rotation.order);
                teleportFloorMesh.rotation.x = 0;
                teleportFloorMesh.rotation.z = 0;
                teleportFloorMesh.scale.copy(controllerScale);
                teleportFloorMesh.updateMatrixWorld();

                teleportFloorMesh.visible = true;
                teleportAirMesh.visible = false;
              } else {
                const {axes} = gamepad;
                const axisFactor = (axes[1] - (-1)) / 2;
                const teleportDistance = axisFactor * TELEPORT_DISTANCE * ((controllerScale.x + controllerScale.y + controllerScale.z) / 3);

                teleportAirMesh.position.copy(controllerPosition)
                  .add(
                    localVector.copy(forwardVector)
                      .applyQuaternion(controllerRotation)
                      .multiplyScalar(teleportDistance)
                  );
                teleportAirMesh.rotation.setFromQuaternion(controllerRotation, camera.rotation.order);
                teleportAirMesh.rotation.x = 0;
                teleportAirMesh.rotation.z = 0;
                teleportAirMesh.scale.copy(controllerScale);
                teleportAirMesh.updateMatrixWorld();

                teleportAirMesh.visible = true;
                teleportFloorMesh.visible = false;
              }
            } else {
              if (teleportFloorMesh.visible) {
                const vrMode = bootstrap.getVrMode();

                if (vrMode === 'hmd') {
                  const cameraPosition = camera.getWorldPosition(localVector);
                  const hmdOffsetY = localVector2.setFromMatrixPosition(webvr.getSittingToStandingTransform()).y + hmdLocalPosition.y;
                  // const hmdOffsetY = hmdLocalPosition.y;
                  const teleportMeshEuler = localEuler.setFromQuaternion(teleportFloorMesh.quaternion, 'XZY');
                  teleportMeshEuler.y = 0;
                  webvr.setStageMatrix(
                    localMatrix.copy(webvr.getStageMatrix())
                      .premultiply(localMatrix2.makeTranslation(
                        -cameraPosition.x,
                        -cameraPosition.y,
                        -cameraPosition.z
                      )) // move back to origin
                      .premultiply(localMatrix2.makeTranslation(0, hmdOffsetY, 0)) // move to height
                      .premultiply(localMatrix2.makeRotationFromEuler(teleportMeshEuler)) // rotate to mesh normal
                      .premultiply(localMatrix2.makeTranslation(
                        teleportFloorMesh.position.x,
                        teleportFloorMesh.position.y,
                        teleportFloorMesh.position.z
                      )) // move to teleport location
                  );
                } else if (vrMode === 'keyboard') {
                  const hmdLocalEuler = localEuler.setFromQuaternion(hmdLocalRotation, 'YXZ');
                  hmdLocalEuler.y = 0;

                  webvr.setStageMatrix(
                    localMatrix.copy(camera.matrixWorldInverse)
                      .multiply(webvr.getStageMatrix()) // move back to origin
                      .premultiply(localMatrix2.makeRotationFromEuler(hmdLocalEuler)) // rotate to HMD
                      .premultiply(teleportFloorMesh.matrixWorld) // move to teleport location
                      .premultiply(webvr.getSittingToStandingTransform()) // move above target
                  );
                }

                webvr.updateStatus();
                cyborg.update();

                teleportApi.emit('teleport');
              } else if (teleportAirMesh.visible) {
                const vrMode = bootstrap.getVrMode();

                if (vrMode === 'hmd') {
                  const cameraPosition = camera.getWorldPosition();
                  const hmdOffsetY = _decomposeMatrix(webvr.getSittingToStandingTransform()).position.y + hmdLocalPosition.y;
                  // const hmdOffsetY = hmdLocalPosition.y;
                  const teleportMeshEuler = new THREE.Euler().setFromQuaternion(teleportAirMesh.quaternion, 'XZY');
                  teleportMeshEuler.y = 0;
                  webvr.setStageMatrix(
                    webvr.getStageMatrix().clone()
                      .premultiply(new THREE.Matrix4().makeTranslation(
                        -cameraPosition.x,
                        -cameraPosition.y,
                        -cameraPosition.z
                      )) // move back to origin
                      .premultiply(new THREE.Matrix4().makeTranslation(0, hmdOffsetY, 0)) // move to height
                      .premultiply(new THREE.Matrix4().makeRotationFromEuler(teleportMeshEuler)) // rotate to mesh normal
                      .premultiply(new THREE.Matrix4().makeTranslation(
                        teleportAirMesh.position.x,
                        teleportAirMesh.position.y,
                        teleportAirMesh.position.z
                      )) // move to teleport location
                  );
                } else if (vrMode === 'keyboard') {
                  const hmdLocalEuler = new THREE.Euler().setFromQuaternion(hmdLocalRotation, 'YXZ');

                  webvr.setStageMatrix(
                    camera.matrixWorldInverse.clone()
                      .multiply(webvr.getStageMatrix()) // move back to origin
                      .premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(hmdLocalEuler.x, 0, hmdLocalEuler.z, 'YXZ'))) // rotate to HMD
                      .premultiply(teleportAirMesh.matrixWorld) // move to teleport location
                      .premultiply(webvr.getSittingToStandingTransform()) // move above target
                  );
                }

                webvr.updateStatus();
                cyborg.update();

                teleportApi.emit('teleport');
              }

              teleportFloorMesh.visible = false;
              teleportAirMesh.visible = false;
            }
          }
        };
        rend.on('update', _update);

        this._cleanup = ()  => {
          intersect.destroyIntersecter(intersecter);

          SIDES.forEach(side => {
            scene.remove(teleportFloorMeshes[side]);
            scene.remove(teleportAirMeshes[side]);
          });

          input.removeListener('paddown', _paddown);
          input.removeListener('padup', _padup);

          rend.removeListener('update', _update);
        };

        class TeleportApi extends EventEmitter {
          addTarget(target) {
            targets.push(target);
          }

          removeTarget(target) {
            targets.splice(targets.indexOf(target), 1);
          }

          reindex() {
            // XXX remove this
          }

          getHoverState(side) {
            // XXX remove this
            /* intersecter.update(side);
            return intersecter.getHoverState(side); */
          }
        }
        const teleportApi = new TeleportApi();

        return teleportApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Teleport;
