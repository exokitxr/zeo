const POSITION_SPEED = 0.05;
const POSITION_SPEED_FAST = POSITION_SPEED * 5;
const ROTATION_SPEED = 0.02 / (Math.PI * 2);

const NUM_PREV_STATUSES = 3;

const BUTTON_COLOR = 0xFF4444;
const BUTTON_COLOR_HIGHLIGHT = 0xffbb33;

const SIDES = ['left', 'right'];

class Cyborg {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {home: {enabled: homeEnabled}, server: {enabled: serverEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
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
          const {THREE, scene, camera} = three;
          const {models: {hmdModelMesh, controllerModelMesh}} = assets;
          const {events} = jsUtils;
          const {EventEmitter} = events;

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
            }

            update(hmdStatus) {
              const {mesh} = this;
              mesh.position.copy(hmdStatus.position);
              mesh.quaternion.copy(hmdStatus.rotation);
              // mesh.scale.copy(gamepadStatus.scale);
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
                  // scale: hmdStatus.scale.toArray(),
                },
                username: rend.getStatus('username'),
              });
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
                    color: 0x44c2ff,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(rayMesh);
                object.rayMesh = rayMesh;

                const buttonSolidMaterial = new THREE.MeshPhongMaterial({
                  color: BUTTON_COLOR_HIGHLIGHT,
                  shininess: 0,
                  // opacity: 0.75,
                  // transparent: true,
                });
                const buttonWireframeMaterial = new THREE.MeshBasicMaterial({
                  color: 0x333333,
                  wireframe: true,
                  opacity: 0.5,
                  transparent: true,
                });

                const padMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(0.005, 0.005, 0.005)
                    .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.0075, 0.05));
                  const padMeshSolidMaterial = new THREE.MeshPhongMaterial({
                    color: BUTTON_COLOR,
                    shininess: 0,
                    // opacity: 0.75,
                    // transparent: true,
                  });
                  const materials = [padMeshSolidMaterial, buttonWireframeMaterial];

                  const mesh = new THREE.Mesh(geometry, materials);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(padMesh);
                object.padMesh = padMesh;

                const menuMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.01)
                    .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.01 / 2, 0.02));
                  const materials = [buttonSolidMaterial, buttonWireframeMaterial];

                  const mesh = new THREE.Mesh(geometry, materials);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(menuMesh);
                object.menuMesh = menuMesh;

                const triggerMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.02)
                    .applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.029, 0.0475));
                  const materials = [buttonSolidMaterial, buttonWireframeMaterial];

                  const mesh = new THREE.Mesh(geometry, materials);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(triggerMesh);
                object.triggerMesh = triggerMesh;

                const gripMesh = (() => {
                  const _makeGripSideGeometry = index => {
                    const geometry = new THREE.BoxBufferGeometry(0.01, 0.0125, 0.0275)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0.0175 * ((index === 0) ? 1 : -1), -0.015, 0.0875));
                    return geometry;
                  };

                  const geometry = geometryUtils.mergeBufferGeometry(
                    _makeGripSideGeometry(0),
                    _makeGripSideGeometry(1)
                  );
                  const materials = [buttonSolidMaterial, buttonWireframeMaterial];

                  const mesh = new THREE.Mesh(geometry, materials);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(gripMesh);
                object.gripMesh = gripMesh;

                return object;
              })();
              this.mesh = mesh;
            }

            update(gamepadStatus) {
              const {mesh} = this;

              mesh.position.copy(gamepadStatus.position);
              mesh.quaternion.copy(gamepadStatus.rotation);
              // mesh.scale.copy(gamepadStatus.scale);

              const {buttons} = gamepadStatus;
              mesh.padMesh.visible = buttons.pad.touched;
              mesh.padMesh.position.y = buttons.pad.pressed ? -0.0025 : 0;
              mesh.padMesh.material[0].color.setHex(buttons.pad.pressed ? BUTTON_COLOR_HIGHLIGHT : BUTTON_COLOR);
              mesh.triggerMesh.visible = buttons.trigger.pressed;
              mesh.gripMesh.visible = buttons.grip.pressed;
              mesh.menuMesh.visible = buttons.menu.pressed;
              const {axes} = gamepadStatus;
              mesh.padMesh.position.x = axes[0] * 0.02;
              mesh.padMesh.position.z = -axes[1] * 0.02;

              mesh.updateMatrixWorld();
            }
          }

          const player = new Player();

          const hmd = new Hmd();
          const {mesh: hmdMesh, labelMesh: hmdLabelMesh} = hmd;
          camera.parent.add(hmdMesh);
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

          const _open = () => {
            const mode = webvr.getMode();

            SIDES.forEach(side => {
              const controllerMesh = controllerMeshes[side];
              const {rayMesh} = controllerMesh;
              rayMesh.visible = mode === side || mode === null;
            });
          };
          rend.on('open', _open);
          const _close = () => {
            SIDES.forEach(side => {
              const controllerMesh = controllerMeshes[side];
              const {rayMesh} = controllerMesh;
              rayMesh.visible = false;
            });
          };
          rend.on('close', _close);
          const _modeChange = mode => {
            if (rend.isOpen() || homeEnabled) {
              SIDES.forEach(side => {
                const controllerMesh = controllerMeshes[side];
                const {rayMesh} = controllerMesh;
                rayMesh.visible = mode === side || mode === null;
              });
            }
          };
          webvr.on('modeChange', _modeChange);

          const _getPlayer = () => player;
          const _getHmd = () => hmd;
          const _getControllers = () => controllers;
          const _update = () => {
            // update camera
            const status = webvr.getStatus();
            const {hmd: hmdStatus} = status;
            camera.position.copy(hmdStatus.position);
            camera.quaternion.copy(hmdStatus.rotation);
            camera.parent.scale.copy(hmdStatus.scale);
            camera.updateMatrixWorld();

            // update hmd
            hmd.update(hmdStatus);

            // update controllers
            const {gamepads: gamepadsStatus} = status;
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
            const {mesh: hmdMesh} = hmd;
            hmdMesh.visible = false;
          };
          rend.on('renderStart', _renderStart);
          const _renderEnd = () => {
            const {mesh: hmdMesh} = hmd;
            hmdMesh.visible = true;
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

            const {mesh: hmdMesh, labelMesh: hmdLabelMesh} = hmd;
            camera.parent.remove(hmdMesh);
            camera.parent.remove(hmdLabelMesh);
            SIDES.forEach(side => {
              const controller = controllers[side];
              const {mesh: controllerMesh} = controller;
              camera.parent.remove(controllerMesh);
            });

            rend.removeListener('open', _open);
            rend.removeListener('close', _close);
            webvr.removeListener('modeChange', _modeChange);
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
