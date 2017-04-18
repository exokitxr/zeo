import {
  KEYBOARD_WIDTH,
  KEYBOARD_HEIGHT,
  KEYBOARD_WORLD_WIDTH,
  KEYBOARD_WORLD_HEIGHT,
  KEYBOARD_WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/keyboard';
import keyboardImg from './lib/img/keyboard';

const keyboardImgSrc = 'data:image/svg+xml;base64,' + btoa(keyboardImg);

const SIDES = ['left', 'right'];

class Keyboard {
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
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/utils/geometry-utils',
      '/core/utils/creature-utils',
    ]).then(([
      input,
      three,
      webvr,
      biolumi,
      rend,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = three;

        const transparentImg = biolumi.getTransparentImg();
        const transparentMaterial = biolumi.getTransparentMaterial();

        const oneVector = new THREE.Vector3(1, 1, 1);

        const _decomposeObjectMatrixWorld = object => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          object.matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const localUpdates = [];

        const keyboardMesh = (() => {
          const object = new THREE.Object3D();
          object.position.set(0, DEFAULT_USER_HEIGHT, 0);

          const planeMesh = (() => {
            const _requestKeyboardImage = () => new Promise((accept, reject) => {
              const img = new Image();
              img.src = keyboardImgSrc;
              img.onload = () => {
                accept(img);
              };
              img.onerror = err => {
                reject(err);
              };
            });

            const geometry = new THREE.PlaneBufferGeometry(KEYBOARD_WORLD_WIDTH, KEYBOARD_WORLD_HEIGHT);
            const material = (() => {
              const texture = new THREE.Texture(
                transparentImg,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping,
                THREE.ClampToEdgeWrapping,
                THREE.LinearFilter,
                THREE.LinearFilter,
                THREE.RGBAFormat,
                THREE.UnsignedByteType,
                16
              );

              _requestKeyboardImage()
                .then(img => {
                  texture.image = img;
                  texture.needsUpdate = true;
                })
                .catch(err => {
                  console.warn(err);
                });

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                alphaTest: 0.5,
              });
              return material;
            })();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 1 - DEFAULT_USER_HEIGHT;
            mesh.position.z = -0.4;
            mesh.rotation.x = -Math.PI * (3 / 8);

            const shadowMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(KEYBOARD_WORLD_WIDTH, KEYBOARD_WORLD_HEIGHT, 0.01);
              const material = transparentMaterial;
              const mesh = new THREE.Mesh(geometry, material);
              mesh.castShadow = true;
              return mesh;
            })();
            mesh.add(shadowMesh);

            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          const keySpecs = (() => {
            class KeySpec {
              constructor(key, rect) {
                this.key = key;
                this.rect = rect;

                this.anchorBoxTarget = null;
              }
            }

            const div = document.createElement('div');
            div.style.cssText = 'position: absolute; top: 0; left: 0; width: ' + KEYBOARD_WIDTH + 'px; height: ' + KEYBOARD_HEIGHT + 'px;';
            div.innerHTML = keyboardImg;

            document.body.appendChild(div);

            const keyEls = div.querySelectorAll(':scope > svg > g[key]');
            const result = Array(keyEls.length);
            for (let i = 0; i < keyEls.length; i++) {
              const keyEl = keyEls[i];
              const key = keyEl.getAttribute('key');
              const rect = keyEl.getBoundingClientRect();

              const keySpec = new KeySpec(key, rect);
              result[i] = keySpec;
            }

            document.body.removeChild(div);

            return result;
          })();
          object.keySpecs = keySpecs;

          const _updateKeySpecAnchorBoxTargets = () => {
            object.updateMatrixWorld();
            const {position: keyboardPosition, rotation: keyboardRotation} = _decomposeObjectMatrixWorld(planeMesh);

            for (let i = 0; i < keySpecs.length; i++) {
              const keySpec = keySpecs[i];
              const {key, rect} = keySpec;

              const anchorBoxTarget = geometryUtils.makeBoxTargetOffset(
                keyboardPosition,
                keyboardRotation,
                oneVector,
                new THREE.Vector3(
                  -(KEYBOARD_WORLD_WIDTH / 2) + (rect.left / KEYBOARD_WIDTH) * KEYBOARD_WORLD_WIDTH,
                  (KEYBOARD_WORLD_HEIGHT / 2) + (-rect.top / KEYBOARD_HEIGHT) * KEYBOARD_WORLD_HEIGHT,
                  -KEYBOARD_WORLD_DEPTH
                ),
                new THREE.Vector3(
                  -(KEYBOARD_WORLD_WIDTH / 2) + (rect.right / KEYBOARD_WIDTH) * KEYBOARD_WORLD_WIDTH,
                  (KEYBOARD_WORLD_HEIGHT / 2) + (-rect.bottom / KEYBOARD_HEIGHT) * KEYBOARD_WORLD_HEIGHT,
                  KEYBOARD_WORLD_DEPTH
                )
              );
              keySpec.anchorBoxTarget = anchorBoxTarget;
            }
          };
          _updateKeySpecAnchorBoxTargets();
          object.updateKeySpecAnchorBoxTargets = _updateKeySpecAnchorBoxTargets;

          return object;
        })();
        scene.add(keyboardMesh);

        const keyboardBoxMeshes = {
          left: biolumi.makeMenuBoxMesh(),
          right: biolumi.makeMenuBoxMesh(),
        };
        scene.add(keyboardBoxMeshes.left);
        scene.add(keyboardBoxMeshes.right);

        const _makeKeyboardHoverState = () => ({
          key: null,
        });
        const keyboardHoverStates = {
          left: _makeKeyboardHoverState(),
          right: _makeKeyboardHoverState(),
        };

        const _update = () => {
          if (rend.isOpen()) {
            const {gamepads} = webvr.getStatus();

            SIDES.forEach(side => {
              const gamepad = gamepads[side];

              if (gamepad) {
                const {position: controllerPosition} = gamepad;

                const keyboardHoverState = keyboardHoverStates[side];
                const keyboardBoxMesh = keyboardBoxMeshes[side];

                // NOTE: there should be at most one intersecting anchor box since keys do not overlap
                const {keySpecs} = keyboardMesh;
                const newKeySpec = keySpecs.find(keySpec => keySpec.anchorBoxTarget.containsPoint(controllerPosition));

                const {key: oldKey} = keyboardHoverState;
                const newKey = newKeySpec ? newKeySpec.key : null;
                keyboardHoverState.key = newKey;

                if (oldKey && newKey !== oldKey) {
                  const key = oldKey;
                  const keyCode = biolumi.getKeyCode(key);

                  input.triggerEvent('keyboardup', {
                    key,
                    keyCode,
                    side,
                  });
                }
                if (newKey && newKey !== oldKey) {
                  const key = newKey;
                  const keyCode = biolumi.getKeyCode(key);

                  input.triggerEvent('keyboarddown', {
                    key,
                    keyCode,
                    side,
                  });
                  input.triggerEvent('keyboardpress', {
                    key,
                    keyCode,
                    side,
                  });
                }

                if (newKeySpec) {
                  const {anchorBoxTarget} = newKeySpec;

                  keyboardBoxMesh.position.copy(anchorBoxTarget.position);
                  keyboardBoxMesh.quaternion.copy(anchorBoxTarget.quaternion);
                  keyboardBoxMesh.scale.copy(anchorBoxTarget.size);

                  if (!keyboardBoxMesh.visible) {
                    keyboardBoxMesh.visible = true;
                  }
                } else {
                  if (keyboardBoxMesh.visible) {
                    keyboardBoxMesh.visible = false;
                  }
                }
              }
            });
          }
        };
        rend.on('update', _update);

        this._cleanup = () => {
           scene.remove(keyboardMesh);

          SIDES.forEach(side => {
            scene.remove(keyboardBoxMeshes[side]);
          });

          rend.removeListener('update', _update);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Keyboard;
