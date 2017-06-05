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
    ]).then(([
      bootstrap,
      three,
      webvr,
      input,
      rend,
      intersect,
      cyborg,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const forwardVector = new THREE.Vector3(0, 0, -1);
        const teleportMeshMaterial = new THREE.MeshPhongMaterial({
          color: 0xFFC107,
          shading: THREE.FlatShading,
          opacity: 0.5,
          transparent: true,
        });

        const intersecter = intersect.makeIntersecter({
          frameRate: 20,
          intersectMeshKey: '_teleportIntersectMesh',
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
                const {position, normal} = hoverState;

                teleportFloorMesh.position.copy(position);
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
                teleportFloorMesh.scale.copy(controllerScale);

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
                  const sittingToStandingTransformMatrix = webvr.getSittingToStandingTransform();
                  const hmdStagePosition = hmdLocalPosition.clone().applyMatrix4(sittingToStandingTransformMatrix);
                  const teleportMeshEuler = new THREE.Euler().setFromQuaternion(teleportFloorMesh.quaternion, 'XZY');
                  teleportMeshEuler.y = 0;
                  webvr.setStageMatrix(
                    camera.matrixWorldInverse.clone()
                      .multiply(sittingToStandingTransformMatrix) // move back to origin
                      .premultiply(new THREE.Matrix4().makeTranslation(-hmdStagePosition.x, 0, -hmdStagePosition.z))
                      .premultiply(new THREE.Matrix4().makeRotationFromEuler(teleportMeshEuler))
                      .premultiply(new THREE.Matrix4().makeTranslation(
                        teleportFloorMesh.position.x,
                        teleportFloorMesh.position.y,
                        teleportFloorMesh.position.z
                      )) // move to teleport location
                  );

                  webvr.updateStatus();
                  cyborg.update();
                } else if (vrMode === 'keyboard') {
                  webvr.setStageMatrix(
                    camera.matrixWorldInverse.clone()
                      .multiply(webvr.getStageMatrix()) // move back to origin
                      .premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(hmdLocalEuler.x, 0, hmdLocalEuler.z, 'YXZ'))) // rotate to HMD
                      .premultiply(teleportFloorMesh.matrixWorld) // move to teleport location
                      .premultiply(webvr.getSittingToStandingTransform()) // move above target
                  );

                  webvr.updateStatus();
                  cyborg.update();
                }

                teleportState.teleportFloorPoint = null;
              } else if (teleportAirPoint) {
                const vrMode = bootstrap.getVrMode();
                if (vrMode === 'hmd') {
                  const sittingToStandingTransformMatrix = webvr.getSittingToStandingTransform();
                  const hmdStagePosition = hmdLocalPosition.clone().applyMatrix4(sittingToStandingTransformMatrix);
                  const teleportMeshEuler = new THREE.Euler().setFromQuaternion(teleportAirMesh.quaternion, 'XZY');
                  teleportMeshEuler.y = 0;
                  webvr.setStageMatrix(
                    camera.matrixWorldInverse.clone()
                      .multiply(sittingToStandingTransformMatrix) // move back to origin
                      .premultiply(new THREE.Matrix4().makeTranslation(-hmdStagePosition.x, 0, -hmdStagePosition.z))
                      .premultiply(new THREE.Matrix4().makeRotationFromEuler(teleportMeshEuler))
                      .premultiply(new THREE.Matrix4().makeTranslation(
                        teleportAirMesh.position.x,
                        teleportAirMesh.position.y,
                        teleportAirMesh.position.z
                      )) // move to teleport location
                  );

                  webvr.updateStatus();
                  cyborg.update();
                } else if (vrMode === 'keyboard') {
                  webvr.setStageMatrix(
                    camera.matrixWorldInverse.clone()
                      .multiply(webvr.getStageMatrix()) // move back to origin
                      .premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(hmdLocalEuler.x, 0, hmdLocalEuler.z, 'YXZ'))) // rotate to HMD
                      .premultiply(teleportAirMesh.matrixWorld) // move to teleport location
                      .premultiply(webvr.getSittingToStandingTransform()) // move above target
                  );

                  webvr.updateStatus();
                  cyborg.update();
                }

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

        const _addTarget = object => {
          intersecter.addTarget(object);
          intersecter.reindex();
        };
        const _removeTarget = object => {
          intersecter.removeTarget(object);
          intersecter.reindex();
        };
        const _reindex = () => {
          intersecter.reindex();
        };

        return {
          addTarget: _addTarget,
          removeTarget: _removeTarget,
          reindex: _reindex,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Teleport;
