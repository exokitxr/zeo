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

        class Controller {
          constructor(index) {
            this._index = index;

            const mesh = (() => {
              const result = new THREE.Object3D();

              const inner = (() => {
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

                const tip = (() => {
                  const result = new THREE.Object3D();
                  result.position.z = -1;
                  return result;
                })();
                object.add(tip);
                object.tip = tip;

                return object;
              })();
              result.add(inner);
              result.inner = inner;

              return result;
            })();
            scene.add(mesh);
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

            mesh.position.copy(
              cameraPosition.clone()
                .add(
                  new THREE.Vector3(
                    0.2 * (index === 0 ? -1 : 1),
                    -0.1,
                    -0.2
                  )
                  .applyQuaternion(cameraRotation)
                )
            );
            mesh.quaternion.copy(cameraRotation);

            const {inner} = mesh;
            inner.position.copy(positionOffset);
            inner.rotation.copy(rotationOffset);
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

        const controllerMeshes = (() => {
          const result = [];

          for (let index = 0; index < 2; index++) {
            const controller = new Controller(index)
            result.push(controller);
          }

          result.left = result[0];
          result.right = result[1];

          return result;
        })();

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
              const controller = controllerMeshes.left;

              if (!e.shiftKey) {
                controller.move(e.deltaX, e.deltaY);
              } else {
                controller.rotate(e.deltaX, e.deltaY);
              }
            } else if (mode === 'right') {
              const controller = controllerMeshes.right;

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

        const _getControllerMeshes = () => controllerMeshes;
        const _update = () => {
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

          for (let i = 0; i < controllerMeshes.length; i++) {
            const controller = controllerMeshes[i];
            controller.update();
          }
        };

        this._cleanup = () => {
          renderer.domElement.removeEventListener('click', click);
          window.document.removeEventListener('pointerlockchange', pointerlockchange);
          window.document.removeEventListener('pointerlockerror', pointerlockerror);
          window.removeEventListener('mousemove', mousemove);
          window.removeEventListener('keydown', keydown);
          window.removeEventListener('keyup', keyup);
        };

        return {
          controllerMeshes: _getControllerMeshes,
          update: _update,
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = SinglePlayer;
