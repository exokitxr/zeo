const BULLET_SPEED = 0.05;
const BULLET_TTL = 5 * 1000;

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

class ZGun {
  mount() {
    const {three: {THREE, scene}, input, elements, render, pose, utils: {geometry: geometryUtils}} = zeo;

    const worldElement = elements.getWorldElement();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const _requestAudio = url => new Promise((accept, reject) => {
      const eatAudio = document.createElement('audio');
      eatAudio.src = url;
      eatAudio.oncanplaythrough = () => {
        accept({
          eatAudio,
        });
      };
      eatAudio.onerror = err => {
        reject(err);
      };
    });

    return _requestAudio('/archae/gun/sfx/gun.ogg')
      .then(gunAudio => {
        if (live) {
          const weaponMaterial = new THREE.MeshPhongMaterial({
            color: 0x808080,
            shading: THREE.FlatShading,
          });

          const bulletMaterial = new THREE.MeshPhongMaterial({
            color: 0xFF0000,
            shading: THREE.FlatShading,
          });

          const gunComponent = {
            selector: 'gun[position]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0.5, 1.2, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              grabbable: {
                type: 'checkbox',
                value: true,
              },
              holdable: {
                type: 'checkbox',
                value: true,
              },
              size: {
                type: 'vector',
                value: [0.2, 0.2, 0.2],
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const mesh = (() => {
                const mesh = new THREE.Object3D();

                const coreMesh = (() => {
                  const barrelGeometry = new THREE.BoxBufferGeometry(0.04, 0.2, 0.04)
                    .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.1, -0.005))
                    .applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2) - (Math.PI * 0.3)));
                  const handleGeometry = new THREE.BoxBufferGeometry(0.03, 0.165, 0.05)
                    .applyMatrix(new THREE.Matrix4().makeTranslation(0, -(0.165 / 2), 0))
                    .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.01))
                    .applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
                  const geometry = geometryUtils.concatBufferGeometry([barrelGeometry, handleGeometry]);
                  const material = weaponMaterial;

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                mesh.add(coreMesh);

                const barrelMesh = new THREE.Object3D();
                barrelMesh.rotation.x = -(Math.PI * 0.3);
                barrelMesh.visible = false;
                mesh.add(barrelMesh);

                const barrelTipMesh = new THREE.Object3D();
                barrelTipMesh.position.y = -0.005;
                barrelTipMesh.position.z = -0.2;
                barrelTipMesh.visible = false;
                barrelMesh.add(barrelTipMesh);
                mesh.barrelTipMesh = barrelTipMesh;

                return mesh;
              })();
              entityObject.add(mesh);

              const bullets = [];

              const bulletGeometry = (() => {
                const coreGeometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.02);
                const tipGeometry = new THREE.CylinderBufferGeometry(0, sq(0.005), 0.02, 4, 1)
                  .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
                  .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
                  .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.02 / 2) - (0.02 / 2)));

                return geometryUtils.concatBufferGeometry([coreGeometry, tipGeometry]);
              })();
              const _makeBulletMesh = () => {
                const geometry = bulletGeometry;
                const material = bulletMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.startTime = Date.now();
                mesh.lastTime = mesh.lastTime;
                return mesh;
              };

              entityApi.position = DEFAULT_MATRIX;
              entityApi.align = () => {
                const {position} = entityApi;

                entityObject.position.set(position[0], position[1], position[2]);
                entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                entityObject.scale.set(position[7], position[8], position[9]);
              };

              const _makeGunState = () => ({
                grabbed: false,
              });
              const gunStates = {
                left: _makeGunState(),
                right: _makeGunState(),
              };

              const _grab = e => {
                const {detail: {side}} = e;
                const gunState = gunStates[side];

                gunState.grabbed = true;
              };
              entityElement.addEventListener('grab', _grab);
              const _release = e => {
                const {detail: {side}} = e;
                const gunState = gunStates[side];

                gunState.grabbed = false;
              };
              entityElement.addEventListener('release', _release);
              const _triggerdown = e => {
                const {side} = e;
                const gunState = gunStates[side];
                const {grabbed} = gunState;

                if (grabbed) {
                  const {gamepads} = pose.getStatus();
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    const {barrelTipMesh} = mesh;
                    const {position, rotation, scale} = _decomposeObjectMatrixWorld(barrelTipMesh);

                    const bullet = _makeBulletMesh();
                    bullet.position.copy(position);
                    bullet.quaternion.copy(rotation);
                    bullet.scale.copy(scale);
                    scene.add(bullet);
                    bullets.push(bullet);

                    input.vibrate(side, 1, 20);

                    // XXX play audio here

                    e.stopImmediatePropagation();
                  }
                }
              };
              input.on('triggerdown', _triggerdown, {
                priority: 1,
              });

              const _update = () => {
                const now = Date.now();

                const oldBullets = bullets.slice();
                for (let i = 0; i < oldBullets.length; i++) {
                  const bullet = oldBullets[i];
                  const {startTime} = bullet;
                  const timeSinceStart = now - startTime;

                  if (timeSinceStart < BULLET_TTL) {
                    const {lastTime} = bullet;
                    const timeDiff = now - lastTime;

                    bullet.position.add(
                      new THREE.Vector3(0, 0, -BULLET_SPEED * timeDiff)
                        .applyQuaternion(bullet.quaternion)
                    );

                    bullet.lastTime = now;
                  } else {
                    scene.remove(bullet);
                    bullets.splice(bullets.indexOf(bullet), 1);
                  }
                }
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(mesh);

                entityElement.removeEventListener('grab', _grab);
                entityElement.removeEventListener('release', _release);
                input.removeListener('triggerdown', _triggerdown);

                render.removeListener('update', _update);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();

              switch (name) {
                case 'position': {
                  entityApi.position = newValue;

                  entityApi.align();

                  break;
                }
              }
            },
          };
          elements.registerComponent(this, gunComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, gunComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = ZGun;
