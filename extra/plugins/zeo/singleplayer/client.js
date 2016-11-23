const events = require('events');
const EventEmitter = events.EventEmitter;

const controllerModelPath = '/archae/models/controller/controller.json';

const POSITION_SPEED = 0.05;
const POSITION_SPEED_FAST = POSITION_SPEED * 5;
const ROTATION_SPEED = 0.02 / (Math.PI * 2);

class SinglePlayer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    return archae.requestEngines([
      '/core/engines/zeo',
    ])
      .then(([
        zeo,
      ]) => {
        const {THREE, scene, camera, renderer} = zeo;

        class Player extends EventEmitter {
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

          updateHmd({position, rotation}) {
            this.emit('hmdUpdate', {
              position,
              rotation,
            });
          }

          updateController({side, position, rotation}) {
            this.emit('controllerUpdate', {
              side,
              position,
              rotation,
            });
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
            this.mesh = mesh;

            const positionOffset = new THREE.Vector3();
            this.positionOffset = positionOffset;

            const rotationOffset = new THREE.Euler();
            rotationOffset.order = camera.rotation.order;
            this.rotationOffset = rotationOffset;
          }

          update() {
            const {_index: index, mesh, positionOffset, rotationOffset} = this;

            const cameraPosition = new THREE.Vector3();
            const cameraRotation = new THREE.Quaternion();
            const cameraScale = new THREE.Vector3();
            camera.updateMatrixWorld();
            camera.matrixWorld.decompose(cameraPosition, cameraRotation, cameraScale);

            const outerMatrix = (() => {
              const result = new THREE.Matrix4();

              const position = cameraPosition.clone()
                .add(
                  new THREE.Vector3(
                    0.2 * (index === 0 ? -1 : 1),
                    -0.1,
                    -0.2
                  )
                  .applyQuaternion(cameraRotation)
                );
              const rotation = cameraRotation;
              const scale = cameraScale;

              result.compose(position, rotation, scale);

              return result;
            })();
            const innerMatrix = (() => {
              const result = new THREE.Matrix4();

              const position = positionOffset;
              const rotation = new THREE.Quaternion().setFromEuler(rotationOffset);
              const scale = new THREE.Vector3(1, 1, 1);

              result.compose(position, rotation, scale);

              return result;
            })();

            const worldMatrix = outerMatrix.clone().multiply(innerMatrix);
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            worldMatrix.decompose(position, rotation, scale);
            // outerMatrix.decompose(position, rotation, scale);

            mesh.position.copy(position);
            mesh.quaternion.copy(rotation);
            mesh.scale.copy(scale);
          }

          move(x, y) {
            const {positionOffset} = this;

            const moveFactor = 0.001;
            positionOffset.x += -x * moveFactor;
            positionOffset.y += y * moveFactor;
          }

          rotate(x, y) {
            const {rotationOffset} = this;

            const moveFactor = 0.001 * (Math.PI * 2);
            rotationOffset.y = Math.max(Math.min(rotationOffset.y + (x * moveFactor), Math.PI / 2), -Math.PI / 2);
            rotationOffset.x = Math.max(Math.min(rotationOffset.x + (y * moveFactor), Math.PI / 2), -Math.PI / 2);
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
        for (let i = 0; i < controllers.length; i++) {
          const controller = controllers[i];
          const {mesh} = controller;
          scene.add(mesh);
        }

        const keys = {
          up: false,
          down: false,
          left: false,
          right: false,
          shift: false,
        };
        this.keys = keys;

        const _resetKeys = () => {
          keys.up = false;
          keys.down = false;
          keys.left = false;
          keys.right = false;
          keys.shift = false;
        };

        const click = () => {
          renderer.domElement.requestPointerLock();
        };
        const pointerlockchange = e => {
          if (!window.document.pointerLockElement) {
            _resetKeys();
          }
        };
        const pointerlockerror = e => {
          _resetKeys();

          console.warn('pointer lock error', e);
        };
        const mousemove = e => {
          if (window.document.pointerLockElement) {
            const {movementX, movementY} = e;

            camera.rotation.x += (-movementY * ROTATION_SPEED);
            camera.rotation.y += (-movementX * ROTATION_SPEED);
          }
        };
        const mousewheel = e => {
          if (window.document.pointerLockElement) {
            e.preventDefault();

            if (mode === 'left') {
              const controller = controllers.left;

              if (!e.shiftKey) {
                controller.move(e.deltaX, e.deltaY);
              } else {
                controller.rotate(e.deltaX, e.deltaY);
              }
            } else if (mode === 'right') {
              const controller = controllers.right;

              if (!e.shiftKey) {
                controller.move(e.deltaX, e.deltaY);
              } else {
                controller.rotate(e.deltaX, e.deltaY);
              }
            }
          }
        };

        let mode = 'move';
        const keydown = e => {
          if (window.document.pointerLockElement) {
            switch (e.keyCode) {
              case 87: // W
                keys.up = true;
                break;
              case 65: // A
                keys.left = true;
                break;
              case 83: // S
                keys.down = true;
                break;
              case 68: // D
                keys.right = true;
                break;
              case 16: // shift
                keys.shift = true;
                break;
              case 90: // Z
                mode = 'left';
                break;
              case 88: // X
                mode = 'move';
                break;
              case 67: // C
                mode = 'right';
                break;
            }
          }
        };
        const keyup = e => {
          if (window.document.pointerLockElement) {
            switch (e.keyCode) {
              case 87: // W
                keys.up = false;
                break;
              case 65: // A
                keys.left = false;
                break;
              case 83: // S
                keys.down = false;
                break;
              case 68: // D
                keys.right = false;
                break;
              case 16: // shift
                keys.shift = false;
                break;
            }
          }
        };
        renderer.domElement.addEventListener('click', click);
        window.document.addEventListener('pointerlockchange', pointerlockchange);
        window.document.addEventListener('pointerlockerror', pointerlockerror);
        window.addEventListener('mousemove', mousemove);
        window.addEventListener('mousewheel', mousewheel);
        window.addEventListener('keydown', keydown);
        window.addEventListener('keyup', keyup);

        const _getPlayer = () => player;
        const _getControllers = () => controllers;
        const _update = () => {
          // move camera
          const {keys} = this;

          const moveVector = new THREE.Vector3();
          const speed = keys.shift ? POSITION_SPEED_FAST : POSITION_SPEED;
          if (keys.up) {
            moveVector.z -= speed;
          }
          if (keys.down) {
            moveVector.z += speed;
          }
          if (keys.left) {
            moveVector.x -= speed;
          }
          if (keys.right) {
            moveVector.x += speed;
          }

          moveVector.applyQuaternion(camera.quaternion);

          camera.position.x += moveVector.x;
          camera.position.z += moveVector.z;
          camera.position.y += moveVector.y;

          // move controllers
          for (let i = 0; i < controllers.length; i++) {
            const controller = controllers[i];
            controller.update();
          }

          // emit updates
          player.updateHmd({
            position: camera.position.clone(),
            rotation: camera.quaternion.clone(),
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
        };

        this._cleanup = () => {
          for (let i = 0; i < controllers.length; i++) {
            const controller = controllers[i];
            const {mesh} = controller;
            scene.remove(mesh);
          }

          renderer.domElement.removeEventListener('click', click);
          window.document.removeEventListener('pointerlockchange', pointerlockchange);
          window.document.removeEventListener('pointerlockerror', pointerlockerror);
          window.removeEventListener('mousemove', mousemove);
          window.removeEventListener('keydown', keydown);
          window.removeEventListener('keyup', keyup);
        };

        return {
          getPlayer: _getPlayer,
          getControllers: _getControllers,
          update: _update,
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = SinglePlayer;
