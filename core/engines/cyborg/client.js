const POSITION_SPEED = 0.05;
const POSITION_SPEED_FAST = POSITION_SPEED * 5;
const ROTATION_SPEED = 0.02 / (Math.PI * 2);

const NUM_PREV_STATUSES = 3;

const SIDES = ['left', 'right'];

class Cyborg {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {server: {enabled: serverEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/bootstrap',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/assets',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/multiplayer',
      '/core/utils/js-utils',
      '/core/utils/geometry-utils',
    ])
      .then(([
        bootstrap,
        three,
        webvr,
        assets,
        biolumi,
        rend,
        multiplayer,
        jsUtils,
        geometryUtils,
      ]) => {
        if (live) {
          const {THREE, camera} = three;
          const {models: {hmdModelMesh, controllerModelMesh}} = assets;
          const {events} = jsUtils;
          const {EventEmitter} = events;

          const solidMaterial = new THREE.MeshPhongMaterial({
            color: 0x666666,
            shininess: 0,
            shading: THREE.FlatShading,
          });

          const BUTTON_COLOR = 0xFF4444;
          const BUTTON_COLOR_HIGHLIGHT = 0xffbb33;

          const RAY_COLOR = 0x44c2ff;
          const RAY_HIGHLIGHT_COLOR = new THREE.Color(RAY_COLOR).multiplyScalar(0.5).getHex();

          class Player extends EventEmitter {
            constructor() {
              super();

              const _makePositionRotationScale = () => ({
                position: new THREE.Vector3(),
                rotation: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
              });
              this.prevStatuses = [
                {
                  status: {
                    hmd: _makePositionRotationScale(),
                    controllers: {
                      left: _makePositionRotationScale(),
                      right: _makePositionRotationScale(),
                    },
                  },
                  timestamp: Date.now(),
                }
              ];
            }

            getStatus() {
              return {
                hmd: {
                  position: camera.position.clone(),
                  rotation: camera.quaternion.clone(),
                  scale: camera.scale.clone(),
                },
                controllers: {
                  left: {
                    position: controllers.left.mesh.position.clone(),
                    rotation: controllers.left.mesh.quaternion.clone(),
                    scale: controllers.left.mesh.scale.clone(),
                  },
                  right: {
                    position: controllers.right.mesh.position.clone(),
                    rotation: controllers.right.mesh.quaternion.clone(),
                    scale: controllers.right.mesh.scale.clone(),
                  },
                },
              };
            }

            snapshotStatus() {
              const snapshot = {
                status: this.getStatus(),
                timestamp: Date.now(),
              };

              this.prevStatuses.push(snapshot);

              while (this.prevStatuses.length > NUM_PREV_STATUSES) {
                this.prevStatuses.shift();
              }
            }

            getControllerLinearVelocity(side) {
              const {prevStatuses} = this;

              if (prevStatuses.length > 1) {
                const positionDiffs = (() => {
                  const result = Array(prevStatuses.length - 1);
                  for (let i = 0; i < prevStatuses.length - 1; i++) {
                    const prevStatus = prevStatuses[i];
                    const nextStatus = prevStatuses[i + 1];
                    const positionDiff = nextStatus.status.controllers[side].position.clone()
                      .sub(prevStatus.status.controllers[side].position);
                    result[i] = positionDiff;
                  }
                  return result;
                })();
                const positionDiffAcc = new THREE.Vector3(0, 0, 0);
                for (let i = 0; i < positionDiffs.length; i++) {
                  const positionDiff = positionDiffs[positionDiffs.length - 1 - i];
                  positionDiffAcc.add(positionDiff.clone().divideScalar(Math.pow(2, i)));
                }

                const firstStatus = prevStatuses[0];
                const lastStatus = prevStatuses[prevStatuses.length - 1];
                return positionDiffAcc.divideScalar((lastStatus.timestamp - firstStatus.timestamp) / 1000);
              } else {
                return new THREE.Vector3(0, 0, 0);
              }
            }

            getControllerAngularVelocity(side) {
              const {prevStatuses} = this;

              if (prevStatuses.length > 1) {
                const angleDiffs = (() => {
                  const result = Array(prevStatuses.length - 1);
                  for (let i = 0; i < prevStatuses.length - 1; i++) {
                    const prevStatus = prevStatuses[i];
                    const nextStatus = prevStatuses[i + 1];
                    const quaternionDiff = nextStatus.status.controllers[side].rotation.clone()
                      .multiply(prevStatus.status.controllers[side].rotation.clone().inverse());
                    const axisAngle = (() => {
                      const x = quaternionDiff.x / Math.sqrt(1 - (quaternionDiff.w * quaternionDiff.w));
                      const y = quaternionDiff.y / Math.sqrt(1 - (quaternionDiff.w * quaternionDiff.w));
                      const z = quaternionDiff.y / Math.sqrt(1 - (quaternionDiff.w * quaternionDiff.w));
                      const angle = 2 * Math.acos(quaternionDiff.w);

                      return {
                        axis: new THREE.Vector3(x, y, z),
                        angle: angle,
                      };
                    })();
                    const angleDiff = axisAngle.axis.clone().multiplyScalar(axisAngle.angle);
                    result[i] = angleDiff;
                  }
                  return result;
                })();
                const angleDiffAcc = new THREE.Vector3(0, 0, 0);
                for (let i = 0; i < angleDiffs.length; i++) {
                  const angleDiff = angleDiffs[angleDiffs.length - 1 - i];
                  angleDiffAcc.add(angleDiff.clone().divideScalar(Math.pow(2, i)));
                }

                const firstStatus = prevStatuses[0];
                const lastStatus = prevStatuses[prevStatuses.length - 1];
                return angleDiffAcc.divideScalar((lastStatus.timestamp - firstStatus.timestamp) / 1000);
              } else {
                return new THREE.Vector3(0, 0, 0);
              }
            }
          }

          class Hmd {
            constructor() {
              const mesh = hmdModelMesh.clone(true)
              this.mesh = mesh;

              const labelMesh = assets.makePlayerLabelMesh({
                username: rend.getStatus('username'),
              });
              this.labelMesh = labelMesh;

              const hudMesh = (() => {
                const object = new THREE.Object3D();
                // object.visible = false;

                const circleMesh = (() => {
                  const geometry = (() => {
                    const geometry = new THREE.CylinderBufferGeometry(0.05, 0.05, 0.01, 8, 1)
                      .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                      .applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI / 8));

                    const _almostZero = v => Math.abs(v) < 0.001;

                    const {array: positions} = geometry.getAttribute('position');
                    const numPositions = positions.length / 3;
                    for (let i = 0; i < numPositions; i++) {
                      const baseIndex = i * 3;

                      if (_almostZero(positions[baseIndex + 0]) && _almostZero(positions[baseIndex + 1])) {
                        positions[baseIndex + 2] -= 0.005;
                      }
                    }

                    geometry.computeVertexNormals();

                    return geometry;
                  })();
                  const material = solidMaterial;

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.z = -0.1;

                  const notchMesh = (() => {
                    const geometry = new THREE.SphereBufferGeometry(0.005, 5, 4)
                      .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI / 8))
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0.003));
                    const material = solidMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    return mesh;
                  })();
                  mesh.add(notchMesh);
                  mesh.notchMesh = notchMesh;

                  return mesh;
                })();
                object.add(circleMesh);
                object.circleMesh = circleMesh;

                return object;
              })();
              this.hudMesh = hudMesh;
            }

            update(hmdStatus, gamepadStatus) {
              const _updateMesh = () => {
                const {mesh} = this;

                mesh.position.copy(hmdStatus.position);
                mesh.quaternion.copy(hmdStatus.rotation);
                mesh.scale.copy(hmdStatus.scale);
                mesh.updateMatrixWorld();

                const {labelMesh} = this;
                labelMesh.update({
                  hmdStatus: {
                    position: hmdStatus.position.toArray(),
                    rotation: (() => { // flip our own label so it appears to face the right direction in the mirror
                      const euler = new THREE.Euler().setFromQuaternion(hmdStatus.rotation, camera.rotation.order);
                      euler.y += Math.PI;
                      return new THREE.Quaternion().setFromEuler(euler).toArray();
                    })(),
                    scale: hmdStatus.scale.toArray(),
                  },
                  username: rend.getStatus('username'),
                });
              };
              const _updateHmdMesh = () => {
                const {hudMesh} = this;

                const vrMode = bootstrap.getVrMode();
                const mode = webvr.getMode()
                const keys = webvr.getKeys();
                if (vrMode === 'keyboard' && mode !== null && keys !== null) {
                  const {axis} = keys;

                  if (axis) {
                    hudMesh.position.copy(hmdStatus.position);
                    hudMesh.quaternion.copy(hmdStatus.rotation);
                    hudMesh.scale.copy(hmdStatus.scale);

                    const {circleMesh} = hudMesh;
                    const {notchMesh} = circleMesh;
                    const gamepad = gamepadStatus[mode === 'center' ? 'left' : mode];
                    const {axes} = gamepad;
                    notchMesh.position.set(axes[0] * 0.043, axes[1] * 0.043, (1 - new THREE.Vector2(axes[0], axes[1]).length()) * (-0.005));

                    if (!hudMesh.visible) {
                      hudMesh.visible = true;
                    }
                  } else {
                    if (hudMesh.visible) {
                      hudMesh.visible = false;
                    }
                  }
                } else {
                  if (hudMesh.visible) {
                    hudMesh.visible = false;
                  }
                }
              };

              _updateMesh();
              _updateHmdMesh();
            }
          }


          class Controller {
            constructor() {
              const mesh = (() => {
                const object = new THREE.Object3D();

                const controllerMesh = controllerModelMesh.clone(true);
                // const controllerMesh = mesh.children[0];
                // controllerMesh.material.color.setHex(0xFFFFFF);
                // controllerMesh.material.map = loader.load(texturePath);
                // controllerMesh.material.specularMap = loader.load(specularMapPath);
                object.add(controllerMesh);

                /* const tip = (() => {
                  const result = new THREE.Object3D();
                  result.position.z = -1;
                  return result;
                })();
                object.add(tip);
                object.tip = tip; */

                const rayMesh = (() => {
                  const geometry = new THREE.CylinderBufferGeometry(0.001, 0.001, 1, 32, 1)
                    .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                    .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.5));
                  const material = new THREE.MeshBasicMaterial({
                    // color: 0x2196F3,
                    color: RAY_COLOR,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                object.add(rayMesh);
                object.rayMesh = rayMesh;

                return object;
              })();
              this.mesh = mesh;
            }

            update(gamepadStatus) {
              const {mesh} = this;
              mesh.position.copy(gamepadStatus.position);
              mesh.quaternion.copy(gamepadStatus.rotation);
              mesh.scale.copy(gamepadStatus.scale);

              const {buttons} = gamepadStatus;
              if (!buttons.trigger.pressed && mesh.rayMesh.material.color.getHex() !== RAY_COLOR) {
                mesh.rayMesh.material.color.setHex(RAY_COLOR);
              } else if (buttons.trigger.pressed && mesh.rayMesh.material.color.getHex() !== RAY_HIGHLIGHT_COLOR) {
                mesh.rayMesh.material.color.setHex(RAY_HIGHLIGHT_COLOR);
              }

              mesh.updateMatrixWorld();
            }
          }

          const player = new Player();

          const hmd = new Hmd();
          const {mesh: hmdMesh, hudMesh: hmdHudMesh, labelMesh: hmdLabelMesh} = hmd;
          camera.parent.add(hmdMesh);
          camera.parent.add(hmdHudMesh);
          camera.parent.add(hmdLabelMesh);

          const controllers = {
            left: new Controller(),
            right: new Controller(),
          };
          SIDES.forEach(side => {
            const controller = controllers[side];
            const {mesh: controllerMesh} = controller;
            camera.parent.add(controllerMesh);
          });

          const controllerMeshes = {
            left: controllers.left.mesh,
            right: controllers.right.mesh,
          };
          rend.registerAuxObject('controllerMeshes', controllerMeshes);

          const _getPlayer = () => player;
          const _getHmd = () => hmd;
          const _getControllers = () => controllers;
          const _update = () => {
            // update camera
            const {hmd: hmdStatus, gamepads: gamepadsStatus} = webvr.getStatus();
            camera.position.copy(hmdStatus.position);
            camera.quaternion.copy(hmdStatus.rotation);
            camera.scale.copy(hmdStatus.scale);
            camera.parent.matrix.copy(webvr.getExternalMatrix());
            camera.parent.updateMatrixWorld(true);

            // update hmd
            hmd.update(hmdStatus, gamepadsStatus);

            // update controllers
            SIDES.forEach(side => {
              const controller = controllers[side];
              const gamepadStatus = gamepadsStatus[side];

              if (gamepadStatus) {
                controller.update(gamepadStatus);
              }
            });

            // snapshot current status
            player.snapshotStatus();
          };
          rend.on('update', _update);
          const _renderStart = () => {
            const {mesh: hmdMesh, labelMesh: hmdLabelMesh} = hmd;
            hmdMesh.visible = false;
            hmdLabelMesh.visible = false;
          };
          rend.on('renderStart', _renderStart);
          const _renderEnd = () => {
            const {mesh: hmdMesh, labelMesh: hmdLabelMesh} = hmd;
            hmdMesh.visible = true;
            hmdLabelMesh.visible = true;
          };
          rend.on('renderEnd', _renderEnd);

          const cleanups = [];
          const cleanup = () => {
            for (let i = 0; i < cleanups.length; i++) {
              const cleanup = cleanups[i];
              cleanup();
            }
            cleanups.length = 0;
          };

          this._cleanup = () => {
            cleanup();

            solidMaterial.dispose();

            const {mesh: hmdMesh, hudMesh: hmdHudMesh, labelMesh: hmdLabelMesh} = hmd;
            camera.parent.remove(hmdMesh); // XXX need to destroy these meshes to prevent memory leaks
            camera.parent.remove(hmdHudMesh);
            camera.parent.remove(hmdLabelMesh);
            SIDES.forEach(side => {
              const controller = controllers[side];
              const {mesh: controllerMesh} = controller;
              camera.parent.remove(controllerMesh);
            });

            rend.removeListener('update', _update);
            rend.removeListener('renderStart', _renderStart);
            rend.removeListener('renderEnd', _renderEnd);
          };

          return {
            getPlayer: _getPlayer,
            getHmd: _getHmd,
            getControllers: _getControllers,
            update: _update,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Cyborg;
