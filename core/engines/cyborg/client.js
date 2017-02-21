const controllerModelPath = '/archae/models/controller/controller.json';

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

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/rend',
      '/core/engines/bullet',
      '/core/plugins/js-utils',
      '/core/plugins/geometry-utils',
    ])
      .then(([
        three,
        webvr,
        rend,
        bullet,
        jsUtils,
        geometryUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;
          const physicsWorld = bullet.getPhysicsWorld();
          const {events} = jsUtils;
          const {EventEmitter} = events;

          class Player extends EventEmitter {
            constructor() {
              super();

              const _makePositionRotation = () => ({
                position: new THREE.Vector3(),
                rotation: new THREE.Quaternion(),
              });
              this.prevStatuses = [
                {
                  status: {
                    hmd: _makePositionRotation(),
                    controllers: {
                      left: _makePositionRotation(),
                      right: _makePositionRotation(),
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
                },
                controllers: {
                  left: {
                    position: controllers.left.mesh.position.clone(),
                    rotation: controllers.left.mesh.quaternion.clone(),
                  },
                  right: {
                    position: controllers.right.mesh.position.clone(),
                    rotation: controllers.right.mesh.quaternion.clone(),
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

            updateHmd({position, rotation}) {
              const {prevStatuses} = this;
              const lastStatus = prevStatuses[prevStatuses.length - 1];

              if (!position.equals(lastStatus.status.hmd.position) || !rotation.equals(lastStatus.status.hmd.rotation)) {
                this.emit('hmdUpdate', {
                  position,
                  rotation,
                });
              }
            }

            updateController({side, position, rotation}) {
              const {prevStatuses} = this;
              const lastStatus = prevStatuses[prevStatuses.length - 1];

              if (!position.equals(lastStatus.status.controllers[side].position) || !rotation.equals(lastStatus.status.controllers[side].rotation)) {
                const controllerPhysicsBody = controllerPhysicsBodies[side];
                if (controllerPhysicsBody) {
                  controllerPhysicsBody.sync();
                }

                this.emit('controllerUpdate', {
                  side,
                  position,
                  rotation,
                });
              }
            }
          }

          class Controller {
            constructor() {
              const mesh = (() => {
                const object = new THREE.Object3D();

                const loader = new THREE.ObjectLoader();
                loader.load(controllerModelPath, mesh => {
                  // const loader = new THREE.TextureLoader();
                  // const model = mesh.children[0];
                  // model.material.color.setHex(0xFFFFFF);
                  // model.material.map = loader.load(texturePath);
                  // model.material.specularMap = loader.load(specularMapPath);

                  object.add(mesh);
                });

                /* const tip = (() => {
                  const result = new THREE.Object3D();
                  result.position.z = -1;
                  return result;
                })();
                object.add(tip);
                object.tip = tip; */

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
                  const geometry = new THREE.BoxBufferGeometry(0.005, 0.005, 0.005);
                  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.0075, 0.05));
                  const padMeshSolidMaterial = new THREE.MeshPhongMaterial({
                    color: BUTTON_COLOR,
                    shininess: 0,
                    // opacity: 0.75,
                    // transparent: true,
                  });
                  const materials = [padMeshSolidMaterial, buttonWireframeMaterial];

                  const mesh = new THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(padMesh);
                object.padMesh = padMesh;

                const menuMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.01);
                  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.01 / 2, 0.02));
                  const materials = [buttonSolidMaterial, buttonWireframeMaterial];

                  const mesh = new THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(menuMesh);
                object.menuMesh = menuMesh;

                const triggerMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.02);
                  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.029, 0.0475));
                  const materials = [buttonSolidMaterial, buttonWireframeMaterial];

                  const mesh = new THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(triggerMesh);
                object.triggerMesh = triggerMesh;

                const gripMesh = (() => {
                  const _makeGripSideGeometry = index => {
                    const geometry = new THREE.BoxBufferGeometry(0.01, 0.0125, 0.0275);
                    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0.0175 * ((index === 0) ? 1 : -1), -0.015, 0.0875));
                    return geometry;
                  };

                  const geometry = geometryUtils.mergeBufferGeometry(
                    _makeGripSideGeometry(0),
                    _makeGripSideGeometry(1)
                  );
                  const materials = [buttonSolidMaterial, buttonWireframeMaterial];

                  const mesh = new THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
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
              mesh.scale.copy(gamepadStatus.scale);

              const {buttons} = gamepadStatus;
              mesh.padMesh.visible = buttons.pad.touched;
              mesh.padMesh.position.y = buttons.pad.pressed ? -0.0025 : 0;
              mesh.padMesh.children[0].material.color.setHex(buttons.pad.pressed ? BUTTON_COLOR_HIGHLIGHT : BUTTON_COLOR);
              mesh.triggerMesh.visible = buttons.trigger.pressed;
              mesh.gripMesh.visible = buttons.grip.pressed;
              mesh.menuMesh.visible = buttons.menu.pressed;
              const {axes} = gamepadStatus;
              mesh.padMesh.position.x = axes[0] * 0.02;
              mesh.padMesh.position.z = -axes[1] * 0.02;
            }
          }

          const player = new Player();

          const controllers = {
            left: new Controller(),
            right: new Controller(),
          };
          SIDES.forEach(side => {
            const controller = controllers[side];
            const {mesh} = controller;
            scene.add(mesh);
          });

          const controllerPhysicsBodies = {
            left: null,
            right: null,
          };

          const _getPlayer = () => player;
          const _getControllers = () => controllers;
          const _update = () => {
            // update camera
            const status = webvr.getStatus();
            const {hmd} = status;
            camera.position.copy(hmd.position);
            camera.quaternion.copy(hmd.rotation);
            camera.scale.copy(hmd.scale);
            camera.updateMatrixWorld();

            // update controllers
            const {gamepads} = status;
            SIDES.forEach(side => {
              const controller = controllers[side];
              const gamepad = gamepads[side];

              if (gamepad) {
                controller.update(gamepad);
              }
            });

            // emit updates
            player.updateHmd({
              position: hmd.position.clone(),
              rotation: hmd.rotation.clone(),
            });
            SIDES.forEach(side => {
              const controller = controllers[side];
              const {mesh} = controller;

              player.updateController({
                side,
                position: mesh.position.clone(),
                rotation: mesh.quaternion.clone(),
              });
            });

            // snapshot current status
            player.snapshotStatus();
          };
          rend.on('update', _update);

          const cleanups = [];
          const cleanup = () => {
            for (let i = 0; i < cleanups.length; i++) {
              const cleanup = cleanups[i];
              cleanup();
            }
            cleanups.length = 0;
          };

          let enabled = false;
          const _enable = () => {
            enabled = true;

            cleanups.push(() => {
              enabled = false;
            });

            SIDES.forEach(side => {
              const controllerPhysicsBody = new physicsWorld.Compound({
                children: [
                  {
                    type: 'box',
                    dimensions: [0.115, 0.075, 0.215],
                    position: [0, -(0.075 / 2), (0.215 / 2) - 0.045],
                  },
                ],
                mass: 1,
              });
              controllerPhysicsBody.setLinearFactor([0, 0, 0]);
              controllerPhysicsBody.setAngularFactor([0, 0, 0]);
              controllerPhysicsBody.setLinearVelocity([0, 0, 0]);
              controllerPhysicsBody.setAngularVelocity([0, 0, 0]);
              controllerPhysicsBody.disableDeactivation();

              const controller = controllers[side];
              const {mesh} = controller;
              controllerPhysicsBody.setObject(mesh);

              physicsWorld.addConnectionBound(controllerPhysicsBody);
              controllerPhysicsBody.sync();

              controllerPhysicsBodies[side] = controllerPhysicsBody;
            });

            cleanups.push(() => {
              SIDES.forEach(side => {
                const controllerPhysicsBody = controllerPhysicsBodies[side];
                physicsWorld.removeConnectionBound(controllerPhysicsBody);
                controllerPhysicsBodies[side] = null;
              });
            });
          };
          const _disable = () => {
            cleanup();
          };
          const _updateEnabled = () => {
            const connected = bullet.isConnected();

            if (connected && !enabled) {
              _enable();
            } else if (!connected && enabled) {
              _disable();
            };
          };
          const _connectServer = _updateEnabled;
          bullet.on('connectServer', _connectServer);
          const _disconnectServer = _updateEnabled;
          bullet.on('disconnectServer', _disconnectServer);

          this._cleanup = () => {
            cleanup();

            SIDES.forEach(side => {
              const controller = controllers[side];
              const {mesh} = controller;
              scene.remove(mesh);
            });

            rend.removeListener('update', _update);

            bullet.removeListener('connectServer', _connectServer);
            bullet.removeListener('disconnectServer', _disconnectServer);
          };

          return {
            getPlayer: _getPlayer,
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
