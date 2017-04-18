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

    const _requestKeyboardCanvas = () => new Promise((accept, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.ctx = ctx;

        accept(canvas);
      };
      img.onerror = err => {
        reject(err);
      };
      img.src = keyboardImgSrc;
    });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/utils/geometry-utils',
        '/core/utils/creature-utils',
      ]),
      _requestKeyboardCanvas(),
    ]).then(([
      [
        input,
        three,
        webvr,
        biolumi,
        rend,
        geometryUtils,
      ],
      keyboardCanvas,
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

        const keyboardMesh = (() => {
          const object = new THREE.Object3D();
          object.position.set(0, DEFAULT_USER_HEIGHT, 0);

          const planeMesh = (() => {
            const geometry = new THREE.PlaneBufferGeometry(KEYBOARD_WORLD_WIDTH, KEYBOARD_WORLD_HEIGHT);
            const material = (() => {
              const texture = new THREE.Texture(
                keyboardCanvas,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping,
                THREE.ClampToEdgeWrapping,
                THREE.LinearFilter,
                THREE.LinearFilter,
                THREE.RGBAFormat,
                THREE.UnsignedByteType,
                16
              );
              texture.needsUpdate = true;

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

          return object;
        })();
        scene.add(keyboardMesh);

        const keyMesh = (() => {
          const geometry = new THREE.PlaneBufferGeometry(1, 1);
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
            texture.needsUpdate = true;

            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
              transparent: true,
              alphaTest: 0.5,
            });
            return material;
          })();

          const mesh = new THREE.Mesh(geometry, matrerial);
          mesh.visible = false;
          return mesh;
        })();
        scene.add(keyMesh);

        const dotMeshes = {
          left: biolumi.makeMenuDotMesh(),
          right: biolumi.makeMenuDotMesh(),
        };
        scene.add(dotMeshes.left);
        scene.add(dotMeshes.right);

        const boxMeshes = {
          left: biolumi.makeMenuBoxMesh(),
          right: biolumi.makeMenuBoxMesh(),
        };
        scene.add(boxMeshes.left);
        scene.add(boxMeshes.right);

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
                const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;

                const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);
                const {planeMesh} = keyboardMesh;
                const {position: keyboardPosition, rotation: keyboardRotation} = _decomposeObjectMatrixWorld(planeMesh);
                const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(keyboardRotation);
                const negativeYAxis = new THREE.Vector3(0, -1, 0).applyQuaternion(keyboardRotation);
                const keyboardTopLeftPoint = keyboardPosition.clone()
                  .add(xAxis.clone().multiplyScalar(-KEYBOARD_WORLD_WIDTH / 2))
                  .add(negativeYAxis.clone().multiplyScalar(-KEYBOARD_WORLD_HEIGHT / 2));
                const keyboardPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                  new THREE.Vector3(0, 0, -1).applyQuaternion(keyboardRotation),
                  keyboardTopLeftPoint
                );
                const intersectionPoint = keyboardPlane.intersectLine(controllerLine);

                if (intersectionPoint) {
                  const intersectionRay = intersectionPoint.clone().sub(keyboardTopLeftPoint);
                  const x = intersectionRay.clone().projectOnVector(xAxis).dot(xAxis) / KEYBOARD_WORLD_WIDTH * KEYBOARD_WIDTH;
                  const y = intersectionRay.clone().projectOnVector(negativeYAxis).dot(negativeYAxis) / KEYBOARD_WORLD_HEIGHT * KEYBOARD_HEIGHT;
                  const {keySpecs} = keyboardMesh;
                  const matchingKeySpecs = keySpecs.filter(keySpec => {
                    const {rect: {top, bottom, left, right}} = keySpec;
                    return x >= left && x < right && y >= top && y < bottom;
                  });

                  const dotMesh = dotMeshes[side];
                  if (matchingKeySpecs.length > 0) {
                    dotMesh.position.copy(intersectionPoint);

                    const matchingKeySpec = matchingKeySpecs[0];
                    const {key} = matchingKeySpec;

                    if (!dotMesh.visible) {
                      dotMesh.visible = true;
                    }
                  } else {
                    if (dotMesh.visible) {
                      dotMesh.visible = false;
                    }
                  }

                  /* const keyboardHoverState = keyboardHoverStates[side];
                  const keyboardBoxMesh = keyboardBoxMeshes[side];

                  // NOTE: there should be at most one intersecting anchor box since keys do not overlap

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
                  } */
                }
              }
            });
          }
        };
        rend.on('update', _update);

        this._cleanup = () => {
          scene.remove(keyboardMesh);
          scene.remove(keyMesh);

          SIDES.forEach(side => {
            scene.remove(dotMesh.right);
            scene.remove(boxMesh.right);
          });

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
