const events = require('events');
const EventEmitter = events.EventEmitter;

const controllerModelPath = '/archae/models/controller/controller.json';

const POSITION_SPEED = 0.05;
const POSITION_SPEED_FAST = POSITION_SPEED * 5;
const ROTATION_SPEED = 0.02 / (Math.PI * 2);

const NUM_PREV_STATUSES = 2;

class SinglePlayer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    return archae.requestEngines([
      '/core/engines/zeo',
      '/core/engines/webvr',
    ])
      .then(([
        zeo,
        webvr,
      ]) => {
        const {THREE, scene, camera, renderer} = zeo;
        const world = zeo.getCurrentWorld();
        const {physics} = world;

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
              const result = new THREE.Object3D();

              const loader = new THREE.ObjectLoader();
              loader.load(controllerModelPath, mesh => {
                // const loader = new THREE.TextureLoader();
                // const model = mesh.children[0];
                // model.material.color.setHex(0xFFFFFF);
                // model.material.map = loader.load(texturePath);
                // model.material.specularMap = loader.load(specularMapPath);

                result.add(mesh);
              });

              const tip = (() => {
                const result = new THREE.Object3D();
                result.position.z = -1;
                return result;
              })();
              result.add(tip);
              result.tip = tip;

              return result;
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
            physicsBody.setObject(mesh);
            physics.add(physicsBody);
            this.physicsBody = physicsBody;
          }

          update(gamepadStatus) {
            const {mesh} = this;

            mesh.position.copy(gamepadStatus.position);
            mesh.quaternion.copy(gamepadStatus.rotation);
            mesh.scale.copy(gamepadStatus.scale);
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
        const _getMode = () => mode;
        const _update = () => {
          // update camera
          const status = webvr.getStatus();
          camera.position.copy(status.hmd.position);
          camera.quaternion.copy(status.hmd.rotation);
          camera.scale.copy(status.hmd.scale);

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

        this._cleanup = () => {
          for (let i = 0; i < controllers.length; i++) {
            const controller = controllers[i];
            controller.destroy();
          }
        };

        return {
          getPlayer: _getPlayer,
          getControllers: _getControllers,
          getMode: _getMode,
          update: _update,
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = SinglePlayer;
