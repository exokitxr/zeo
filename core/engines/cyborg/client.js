const mod = require('mod-loop');

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
      '/core/engines/resource',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/multiplayer',
      '/core/utils/js-utils',
      '/core/utils/geometry-utils',
      '/core/utils/skin-utils',
    ])
      .then(([
        bootstrap,
        three,
        webvr,
        resource,
        biolumi,
        rend,
        multiplayer,
        jsUtils,
        geometryUtils,
        skinUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;
          const {models: {hmdModelMesh, controllerModelMesh}} = resource;
          const {events} = jsUtils;
          const {EventEmitter} = events;

          const zeroVector = new THREE.Vector3();
          const solidMaterial = new THREE.MeshPhongMaterial({
            color: 0x666666,
            shininess: 0,
            shading: THREE.FlatShading,
          });

          const BUTTON_COLOR = 0xFF4444;
          const BUTTON_COLOR_HIGHLIGHT = 0xffbb33;

          const RAY_COLOR = 0x44c2ff;
          const RAY_HIGHLIGHT_COLOR = new THREE.Color(RAY_COLOR).multiplyScalar(0.5).getHex();

          const _getImageData = img => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return imageData.data;
          };

          class PRS {
            constructor() {
              this.position = new THREE.Vector3();
              this.rotation = new THREE.Quaternion();
              this.scale = new THREE.Vector3(1, 1, 1);
              this.worldPosition = new THREE.Vector3();
              this.worldRotation = new THREE.Quaternion();
              this.worldScale = new THREE.Vector3(1, 1, 1);
            }
          }

          class PrevStatus {
            constructor() {
              // this.hmd = new PRS();
              this.controllers = {
                left: new PRS(),
                right: new PRS(),
              };
              this.timestamp = 0;
            }
          }

          class Player extends EventEmitter {
            constructor() {
              super();

              const prevStatuses = Array(NUM_PREV_STATUSES);
              for (let i = 0; i < NUM_PREV_STATUSES; i++) {
                prevStatuses[i] = new PrevStatus();
              }
              this.prevStatuses = prevStatuses;
              this.prevStatusIndex = NUM_PREV_STATUSES;
            }

            snapshotStatus(status) {
              const {gamepads} = status;

              this.prevStatusIndex = mod(this.prevStatusIndex + 1, NUM_PREV_STATUSES);

              const prevStatus = this.prevStatuses[this.prevStatusIndex];

              /* prevStatus.hmd.position.copy(camera.position);
              prevStatus.hmd.rotation.copy(camera.quaternion);
              prevStatus.hmd.scale.copy(camera.scale);
              prevStatus.hmd.worldPosition.copy(camera.position);
              prevStatus.hmd.worldRotation.copy(camera.quaternion);
              prevStatus.hmd.worldScale.copy(camera.scale); */

              prevStatus.controllers.left.position.copy(gamepads.left.position);
              prevStatus.controllers.left.rotation.copy(gamepads.left.rotation);
              prevStatus.controllers.left.scale.copy(gamepads.left.scale);
              prevStatus.controllers.left.worldPosition.copy(gamepads.left.worldPosition);
              prevStatus.controllers.left.worldRotation.copy(gamepads.left.worldRotation);
              prevStatus.controllers.left.worldScale.copy(gamepads.left.worldScale);

              prevStatus.controllers.right.position.copy(gamepads.right.position);
              prevStatus.controllers.right.rotation.copy(gamepads.right.rotation);
              prevStatus.controllers.right.scale.copy(gamepads.right.scale);
              prevStatus.controllers.right.worldPosition.copy(gamepads.right.worldPosition);
              prevStatus.controllers.right.worldRotation.copy(gamepads.right.worldRotation);
              prevStatus.controllers.right.worldScale.copy(gamepads.right.worldScale);

              prevStatus.timestamp = Date.now();
            }

            getControllerLinearVelocity(side) {
              const {prevStatuses, prevStatusIndex} = this;

              const lastStatus = prevStatuses[prevStatusIndex];
              const firstStatus = prevStatuses[mod(prevStatusIndex + 1, NUM_PREV_STATUSES)];

              const positionDiff = lastStatus.controllers[side].worldPosition.clone()
                .sub(firstStatus.controllers[side].worldPosition);
              const timeDiff = lastStatus.timestamp - firstStatus.timestamp;
              return timeDiff > 0 ? positionDiff.divideScalar(timeDiff / 1000) : zeroVector;
            }

            getControllerAngularVelocity(side) {
              const {prevStatuses, prevStatusIndex} = this;

              const lastStatus = prevStatuses[prevStatusIndex];
              const firstStatus = prevStatuses[mod(prevStatusIndex + 1, NUM_PREV_STATUSES)];

              const quaternionDiff = lastStatus.controllers[side].worldRotation.clone()
                .multiply(firstStatus.controllers[side].worldRotation.clone().inverse());
              const angleDiff = (() => {
                const x = quaternionDiff.x / Math.sqrt(1 - (quaternionDiff.w * quaternionDiff.w));
                const y = quaternionDiff.y / Math.sqrt(1 - (quaternionDiff.w * quaternionDiff.w));
                const z = quaternionDiff.z / Math.sqrt(1 - (quaternionDiff.w * quaternionDiff.w));
                const angle = 2 * Math.acos(quaternionDiff.w);
                return new THREE.Vector3(x, y, z).multiplyScalar(angle);
              })();
              const timeDiff = lastStatus.timestamp - firstStatus.timestamp;
              return timeDiff > 0 ? positionDiff.divideScalar(timeDiff / 1000) : zeroVector;
            }
          }
          const player = new Player();

          const _makePlayerPlaceholderMesh = () => {
            const object = new THREE.Object3D();

            const hmdMesh = (() => {
              const mesh = hmdModelMesh.clone(true);
              mesh.visible = false;
              mesh.worldPosition = new THREE.Vector3();
              mesh.worldRotation = new THREE.Quaternion();
              mesh.worldScale = new THREE.Vector3(1, 1, 1);
              return mesh;
            })();
            object.add(hmdMesh);
            object.hmdMesh = hmdMesh;

            const _makeControllerMesh = () => {
              const object = new THREE.Object3D();

              object.worldPosition = new THREE.Vector3();
              object.worldRotation = new THREE.Quaternion();
              object.worldScale = new THREE.Vector3(1, 1, 1);

              const controllerMesh = controllerModelMesh.clone(true);
              // const controllerMesh = mesh.children[0];
              // controllerMesh.material.color.setHex(0xFFFFFF);
              // controllerMesh.material.map = loader.load(texturePath);
              // controllerMesh.material.specularMap = loader.load(specularMapPath);
              object.add(controllerMesh);

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
            };
            const controllerMeshes = {
              left: _makeControllerMesh(),
              right: _makeControllerMesh(),
            };
            object.add(controllerMeshes.left);
            object.add(controllerMeshes.right);
            object.controllerMeshes = controllerMeshes;

            object.update = (hmdStatus, gamepadsStatus) => {
              const _updateHmdMesh = () => {
                hmdMesh.position.copy(hmdStatus.position);
                hmdMesh.quaternion.copy(hmdStatus.rotation);
                hmdMesh.scale.copy(hmdStatus.scale);

                hmdMesh.worldPosition.copy(hmdStatus.worldPosition);
                hmdMesh.worldRotation.copy(hmdStatus.worldRotation);
                hmdMesh.worldScale.copy(hmdStatus.worldScale);

                /* const {labelMesh} = this;
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
                }); */
              };
              const _updateControllerMeshes = () => {
                _updateControllerMesh(controllerMeshes.left, gamepadsStatus.left);
                _updateControllerMesh(controllerMeshes.right, gamepadsStatus.right);
              };
              const _updateControllerMesh = (controllerMesh, gamepadStatus) => {
                controllerMesh.position.copy(gamepadStatus.position);
                controllerMesh.quaternion.copy(gamepadStatus.rotation);
                controllerMesh.scale.copy(gamepadStatus.scale);

                controllerMesh.worldPosition.copy(gamepadStatus.worldPosition);
                controllerMesh.worldRotation.copy(gamepadStatus.worldRotation);
                controllerMesh.worldScale.copy(gamepadStatus.worldScale);

                const {buttons} = gamepadStatus;
                if (!buttons.trigger.pressed && controllerMesh.rayMesh.material.color.getHex() !== RAY_COLOR) {
                  controllerMesh.rayMesh.material.color.setHex(RAY_COLOR);
                } else if (buttons.trigger.pressed && controllerMesh.rayMesh.material.color.getHex() !== RAY_HIGHLIGHT_COLOR) {
                  controllerMesh.rayMesh.material.color.setHex(RAY_HIGHLIGHT_COLOR);
                }
              };

              _updateHmdMesh();
              _updateControllerMeshes();
            };

            return object;
          }
          const playerPlaceholderMesh = _makePlayerPlaceholderMesh();
          camera.parent.add(playerPlaceholderMesh);
          rend.registerAuxObject('controllerMeshes', playerPlaceholderMesh.controllerMeshes);

          let playerSkinMesh = null;

          const hudMesh = (() => {
            const hudMesh = new THREE.Object3D();
            // hudMesh.visible = false;

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
            hudMesh.add(circleMesh);
            hudMesh.circleMesh = circleMesh;
            hudMesh.update = () => {
              const vrMode = bootstrap.getVrMode();
              const mode = webvr.getMode()
              const keys = webvr.getKeys();
              if (vrMode === 'keyboard' && mode !== null && keys !== null) {
                const {axis} = keys;

                if (axis) {
                  hudMesh.position.copy(hmdStatus.position);
                  hudMesh.quaternion.copy(hmdStatus.rotation);
                  hudMesh.scale.copy(hmdStatus.scale);

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

            return hudMesh;
          })();
          camera.parent.add(hudMesh);

          // camera.parent.add(hmdLabelMesh);

          const _getPlayer = () => player;
          const _getHmd = () => hmd;
          // const _getControllers = () => controllers;
          const _setSkin = (skinImg = null) => {
            if (playerSkinMesh) {
              scene.remove(playerSkinMesh);
              playerSkinMesh.destroy();
              playerSkinMesh = null;

              multiplayer.updateSkin(null);
            }

            if (skinImg) {
              playerSkinMesh = skinUtils.makePlayerMesh(skinImg);
              playerSkinMesh.frustumCulled = false;
              scene.add(playerSkinMesh);

              const skinImgBuffer = _getImageData(skinImg);
              multiplayer.updateSkin(skinImgBuffer);
            }
          };
          const _update = () => {
            const status = webvr.getStatus();
            const {hmd: hmdStatus, gamepads: gamepadsStatus} = status;

            // update player placeholder mesh
            playerPlaceholderMesh.update(hmdStatus, gamepadsStatus);

            // update player skin mesh
            if (playerSkinMesh) {
              playerSkinMesh.update(status);
            }

            // update hud mesh
            hudMesh.update();

            // update camera
            camera.position.copy(hmdStatus.position);
            camera.quaternion.copy(hmdStatus.rotation);
            camera.scale.copy(hmdStatus.scale);
            camera.parent.matrix.copy(webvr.getExternalMatrix());
            camera.parent.updateMatrixWorld(true);

            // snapshot current status
            player.snapshotStatus(status);
          };
          rend.on('update', _update);

          const _updateEyeStart = () => {
            if (!playerSkinMesh) {
              playerPlaceholderMesh.hmdMesh.visible = true;
            } else {
              playerPlaceholderMesh.controllerMeshes.left.visible = false;
              playerPlaceholderMesh.controllerMeshes.right.visible = false;

              playerSkinMesh.setHeadVisible(true);
              playerSkinMesh.visible = true;
            }
          };
          rend.on('updateEyeStart', _updateEyeStart);
          const _updateEyeEnd = () => {
            if (!playerSkinMesh) {
              playerPlaceholderMesh.hmdMesh.visible = false;
            } else {
              playerPlaceholderMesh.controllerMeshes.left.visible = true;
              playerPlaceholderMesh.controllerMeshes.right.visible = true;

              playerSkinMesh.setHeadVisible(false);
              playerSkinMesh.visible = false;
            }
          };
          rend.on('updateEyeEnd', _updateEyeEnd);

          this._cleanup = () => {
            solidMaterial.dispose();

            const {mesh: hmdMesh, /*, labelMesh: hmdLabelMesh*/} = hmd;
            camera.parent.remove(playerPlaceholderMesh);
            camera.parent.remove(hudMesh);
            // camera.parent.remove(hmdLabelMesh);

            rend.removeListener('update', _update);
            rend.removeListener('updateEyeStart', _updateEyeStart);
            rend.removeListener('updateEyeEnd', _updateEyeEnd);
          };

          return {
            getPlayer: _getPlayer,
            getHmd: _getHmd,
            // getControllers: _getControllers,
            setSkin: _setSkin,
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
