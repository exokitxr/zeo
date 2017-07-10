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
      '/core/engines/intersect',
      '/core/engines/cyborg',
      '/core/utils/js-utils',
    ]).then(([
      bootstrap,
      three,
      webvr,
      input,
      rend,
      intersect,
      cyborg,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const forwardVector = new THREE.Vector3(0, 0, -1);
        const teleportMeshMaterial = new THREE.MeshPhongMaterial({
          color: 0xF44336,
          shading: THREE.FlatShading,
          // opacity: 0.5,
          // transparent: true,
        });

        const intersecter = intersect.makeIntersecter({
          frameRate: 10,
        });

        const metadatas = new Map();

        class Metadata {
          constructor(flat) {
            this.flat = flat;
          }
        }

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
          const {hmd, gamepads} = webvr.getStatus();
          const {position: hmdLocalPosition, rotation: hmdLocalRotation} = hmd;
          const hmdLocalEuler = new THREE.Euler().setFromQuaternion(hmdLocalRotation, 'YXZ');

          SIDES.forEach(side => {
            const teleportState = teleportStates[side];
            const {teleporting} = teleportState;
            const gamepad = gamepads[side];
            const teleportFloorMesh = teleportFloorMeshes[side];
            const teleportAirMesh = teleportAirMeshes[side];

            if (teleporting) {
              intersecter.update(side);

              const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale, axes} = gamepad;

              const axisFactor = (axes[1] - (-1)) / 2;
              const teleportDistance = axisFactor * TELEPORT_DISTANCE * ((controllerScale.x + controllerScale.y + controllerScale.z) / 3);

              const hoverState = intersecter.getHoverState(side);
              const {position} = hoverState;

              if (position !== null && position.distanceTo(controllerPosition) <= teleportDistance) {
                const {position, normal, originalObject} = hoverState;
                const metadata = metadatas.get(originalObject);
                const {flat} = metadata;

                teleportFloorMesh.position.copy(position);
                if (flat) {
                  const controllerEuler = new THREE.Euler()
                    .setFromQuaternion(controllerRotation, camera.rotation.order);
                  teleportFloorMesh.rotation.set(0, controllerEuler.y, 0, camera.rotation.order);
                } else {
                  teleportFloorMesh.quaternion.setFromRotationMatrix(
                    new THREE.Matrix4().lookAt(
                      position.clone(),
                      position.clone().add(
                        position.clone().sub(
                          new THREE.Plane().setFromNormalAndCoplanarPoint(
                            normal,
                            position
                          ).projectPoint(controllerPosition)
                        ).normalize()
                      ),
                      normal.clone()
                    )
                  );
                }
                teleportFloorMesh.scale.copy(controllerScale);
                teleportFloorMesh.updateMatrixWorld();

                teleportState.teleportFloorPoint = position;
                teleportState.teleportAirPoint = null;

                if (!teleportFloorMesh.visible) {
                  teleportFloorMesh.visible = true;
                }
                if (teleportAirMesh.visible) {
                  teleportAirMesh.visible = false;
                }
              } else {
                const position = controllerPosition.clone()
                  .add(
                    forwardVector.clone()
                      .applyQuaternion(controllerRotation)
                      .multiplyScalar(teleportDistance)
                  );
                teleportAirMesh.position.copy(position);
                const controllerEuler = new THREE.Euler()
                  .setFromQuaternion(controllerRotation, camera.rotation.order);
                teleportAirMesh.rotation.y = controllerEuler.y;
                teleportAirMesh.scale.copy(controllerScale);
                teleportAirMesh.updateMatrixWorld();

                teleportState.teleportAirPoint = position;
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
                const vrMode = bootstrap.getVrMode();

                if (vrMode === 'hmd') {
                  // const spawnTransform = webvr.getSpawnTransform();
                  // const hmdStagePosition = hmdLocalPosition.clone().applyMatrix4(spawnTransform);
                  const cameraPosition = camera.getWorldPosition();
                  const teleportMeshEuler = new THREE.Euler().setFromQuaternion(teleportFloorMesh.quaternion, 'XZY');
                  teleportMeshEuler.y = 0;
                  webvr.setStageMatrix(
                    webvr.getStageMatrix().clone()
                      .premultiply(new THREE.Matrix4().makeTranslation(
                        -cameraPosition.x,
                        -cameraPosition.y,
                        -cameraPosition.z
                      )) // move back to origin
                      .premultiply(new THREE.Matrix4().makeTranslation(0, hmdLocalPosition.y, 0)) // move to height
                      .premultiply(new THREE.Matrix4().makeRotationFromEuler(teleportMeshEuler)) // rotate to mesh normal
                      .premultiply(new THREE.Matrix4().makeTranslation(
                        teleportFloorMesh.position.x,
                        teleportFloorMesh.position.y,
                        teleportFloorMesh.position.z
                      )) // move to teleport location
                  );
                } else if (vrMode === 'keyboard') {
                  webvr.setStageMatrix(
                    camera.matrixWorldInverse.clone()
                      .multiply(webvr.getStageMatrix()) // move back to origin
                      .premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(hmdLocalEuler.x, 0, hmdLocalEuler.z, 'YXZ'))) // rotate to HMD
                      .premultiply(teleportFloorMesh.matrixWorld) // move to teleport location
                      .premultiply(webvr.getSittingToStandingTransform()) // move above target
                  );
                }

                webvr.updateStatus();
                cyborg.update();

                teleportApi.emit('teleport');

                teleportState.teleportFloorPoint = null;
              } else if (teleportAirPoint) {
                const vrMode = bootstrap.getVrMode();

                if (vrMode === 'hmd') {
                  // const spawnTransform = webvr.getSpawnTransform();
                  // const hmdStagePosition = hmdLocalPosition.clone().applyMatrix4(spawnTransform);
                  const cameraPosition = camera.getWorldPosition();
                  const teleportMeshEuler = new THREE.Euler().setFromQuaternion(teleportAirMesh.quaternion, 'XZY');
                  teleportMeshEuler.y = 0;
                  webvr.setStageMatrix(
                    webvr.getStageMatrix().clone()
                      .premultiply(new THREE.Matrix4().makeTranslation(
                        -cameraPosition.x,
                        -cameraPosition.y,
                        -cameraPosition.z
                      )) // move back to origin
                      .premultiply(new THREE.Matrix4().makeTranslation(0, hmdLocalPosition.y, 0)) // move to height
                      .premultiply(new THREE.Matrix4().makeRotationFromEuler(teleportMeshEuler)) // rotate to mesh normal
                      .premultiply(new THREE.Matrix4().makeTranslation(
                        teleportAirMesh.position.x,
                        teleportAirMesh.position.y,
                        teleportAirMesh.position.z
                      )) // move to teleport location
                  );
                } else if (vrMode === 'keyboard') {
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

                teleportState.teleportAirPoint = null;
              }

              if (teleportFloorMesh.visible) {
                teleportFloorMesh.visible = false;
              }
              if (teleportAirMesh.visible) {
                teleportAirMesh.visible = false;
              }
            }
          });
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
          addTarget(object, {flat = false} = {}) {
            intersecter.addTarget(object);

            const metadata = new Metadata(flat);
            metadatas.set(object, metadata);
          }

          removeTarget(object) {
            intersecter.removeTarget(object);

            metadatas.delete(object);
          }

          reindex() {
            intersecter.reindex();
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
