const controllerModelPath = '/archae/models/controller/controller.json';

const POSITION_SPEED = 0.05;
const POSITION_SPEED_FAST = POSITION_SPEED * 5;
const ROTATION_SPEED = 0.02 / (Math.PI * 2);

const NUM_PREV_STATUSES = 2;

const BUTTON_COLOR = 0xFF4444;
const BUTTON_COLOR_HIGHLIGHT = 0xffbb33;

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
      '/core/plugins/js-utils',
      '/core/plugins/geometry-utils',
    ])
      .then(([
        three,
        webvr,
        rend,
        jsUtils,
        geometryUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera, renderer} = three;
          const world = rend.getCurrentWorld();
          const {physics} = world;
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

            getFirstStatus() {
              return this.prevStatuses[0];
            }

            getLastStatus() {
              return this.prevStatuses[this.prevStatuses.length - 1];
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
                const firstStatus = this.getFirstStatus();
                const lastStatus = this.getLastStatus();

                return lastStatus.status.controllers[side].position.clone()
                  .sub(firstStatus.status.controllers[side].position)
                  .divideScalar((lastStatus.timestamp - firstStatus.timestamp) / 1000);
              } else {
                return new THREE.Vector3(0, 0, 0);
              }
            }

            getControllerAngularVelocity(side) {
              const {prevStatuses} = this;

              if (prevStatuses.length > 1) {
                const firstStatus = this.getFirstStatus();
                const lastStatus = this.getLastStatus();

                const diff = lastStatus.status.controllers[side].rotation.clone()
                  .multiply(firstStatus.status.controllers[side].rotation.clone().inverse());
                const axisAngle = (() => {
                  const x = diff.x / Math.sqrt(1 - (diff.w * diff.w));
                  const y = diff.y / Math.sqrt(1 - (diff.w * diff.w));
                  const z = diff.y / Math.sqrt(1 - (diff.w * diff.w));
                  const angle = 2 * Math.acos(diff.w);

                  return {
                    axis: new THREE.Vector3(x, y, z),
                    angle: angle,
                  };
                })();
                const angularDiff = axisAngle.axis.clone().multiplyScalar(axisAngle.angle);
                const angularVelocity = angularDiff.divideScalar((lastStatus.timestamp - firstStatus.timestamp) / 1000);

                return angularVelocity;
              } else {
                return new THREE.Vector3(0, 0, 0);
              }
            }

            updateHmd({position, rotation}) {
              const lastStatus = player.getLastStatus();

              if (!position.equals(lastStatus.status.hmd.position) || !rotation.equals(lastStatus.status.hmd.rotation)) {
                this.emit('hmdUpdate', {
                  position,
                  rotation,
                });
              }
            }

            updateController({side, position, rotation}) {
              const lastStatus = this.getLastStatus();

              if (!position.equals(lastStatus.status.controllers[side].position) || !rotation.equals(lastStatus.status.controllers[side].rotation)) {
                const controller = controllers[side];
                const {physicsBody} = controller;
                physicsBody.sync();

                this.emit('controllerUpdate', {
                  side,
                  position,
                  rotation,
                });
              }
            }
          }

          class Controller {
            constructor(index) {
              this._index = index;

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
              scene.add(mesh);
              this.mesh = mesh;

              const physicsBody = new physics.Compound({
                children: [
                  {
                    type: 'box',
                    dimensions: [0.115, 0.075, 0.215],
                    position: [0, -(0.075 / 2), (0.215 / 2) - 0.045],
                  },
                ],
                mass: 1,
              });
              physicsBody.setLinearVelocity([0, 0, 0]);
              physicsBody.setAngularVelocity([0, 0, 0]);
              physicsBody.setLinearFactor([0, 0, 0]);
              physicsBody.setAngularFactor([0, 0, 0]);
              physicsBody.disableDeactivation();
              physicsBody.setObject(mesh);
              physics.add(physicsBody);
              this.physicsBody = physicsBody;
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

            destroy() {
              const {mesh, physicsBody} = this;
              scene.remove(mesh);
              physics.remove(physicsBody);
            }
          }

          const player = new Player();

          const controllers = (() => {
            const result = [
              new Controller(0),
              new Controller(1),
            ];
            result.left = result[0];
            result.right = result[1];
            return result;
          })();

          const _getPlayer = () => player;
          const _getControllers = () => controllers;
          const _getMode = () => {
            const display = webvr.getDisplay();
            if (display && display.getMode) {
              return display.getMode();
            } else {
              return 'move';
            }
          };
          const _update = () => {
            // update camera
            const status = webvr.getStatus();
            camera.position.copy(status.hmd.position);
            camera.quaternion.copy(status.hmd.rotation);
            camera.scale.copy(status.hmd.scale);
            camera.updateMatrixWorld();

            // update controllers
            for (let i = 0; i < controllers.length; i++) {
              const controller = controllers[i];
              const gamepadStatus = status.gamepads[i === 0 ? 'left' : 'right'];
              if (gamepadStatus) {
                controller.update(gamepadStatus);
              }
            }

            // emit updates
            player.updateHmd({
              position: status.hmd.position.clone(),
              rotation: status.hmd.rotation.clone(),
            });
            ['left', 'right'].forEach(side => {
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

          this._cleanup = () => {
            for (let i = 0; i < controllers.length; i++) {
              const controller = controllers[i];
              controller.destroy();
            }

            rend.removeListener('update', _update);
          };

          return {
            getPlayer: _getPlayer,
            getControllers: _getControllers,
            getMode: _getMode,
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
