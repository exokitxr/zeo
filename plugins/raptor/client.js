const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');
const menuRenderer = require('./lib/render/menu');

const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

const AUDIO_FILES = [
  '03.ogg',
  '08.ogg',
  '09.ogg',
  '65.ogg',
];
const SIDES = ['left', 'right'];

class Raptor {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestAudios = () => Promise.all(AUDIO_FILES.map(fileName => new Promise((accept, reject) => {
      const audio = document.createElement('audio');
      audio.src = '/archae/raptor/audio/' + fileName;
      audio.oncanplaythrough = () => {
        accept(audio);
      };
      audio.onerror = err => {
        reject(err);
      };
    })));

    return _requestAudios()
      .then(audios => {
        if (live) {
          const {three: {THREE, camera}, elements, render, pose, input, ui, utils: {geometry: geometryUtils}} = zeo;

          const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
          const _decomposeMatrix = matrix => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const THREEConvexGeometry = ConvexGeometry(THREE);

          const sqrt2 = Math.sqrt(2);
          const hexahedronGeometry = (() => {
            const points = [
              new THREE.Vector3(0, 0.1, 0),
              new THREE.Vector3(-0.1, 0, 0),
              new THREE.Vector3(0.1, 0, 0),
              new THREE.Vector3(0, 0, 0.1 / sqrt2),
              new THREE.Vector3(0, 0, -0.1 / sqrt2),
              new THREE.Vector3(0, -0.1, 0),
            ];
            return new THREEConvexGeometry(points);
          })();
          const pyramidGeometry = (() => {
            const points = [
              new THREE.Vector3(-0.1, 0, -0.1),
              new THREE.Vector3(0.1, 0, -0.1),
              new THREE.Vector3(0, 0, 0.1 / sqrt2),
              new THREE.Vector3(0, -0.1, 0),
            ];
            return new THREEConvexGeometry(points);
          })();
          const triangleGeometry = (() => {
            const points = [
              new THREE.Vector3(0, 0.1, 0),
              new THREE.Vector3(-0.1, 0, 0),
              new THREE.Vector3(0.1, 0, 0),
              new THREE.Vector3(0, 0, 0.1 / sqrt2),
              new THREE.Vector3(0, 0, -0.1 / sqrt2),
            ];
            return new THREEConvexGeometry(points);
          })();
          const longGeometry = (() => {
            const points = [
              new THREE.Vector3(-0.1, 0, 0),
              new THREE.Vector3(0.1, 0, 0),
              new THREE.Vector3(0, -0.05, 0.05),
              new THREE.Vector3(0, 0, -0.2),
            ];
            return new THREEConvexGeometry(points);
          })();
          const tallGeometry = (() => {
            const points = [
              new THREE.Vector3(0, 0.05, 0.1),
              new THREE.Vector3(0, 0.1, -0.1),
              new THREE.Vector3(-0.075, 0, 0),
              new THREE.Vector3(0, -0.2, -0.1),
            ];
            return new THREEConvexGeometry(points);
          })();
          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });

          const raptorComponent = {
            selector: 'raptor[position]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 0, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const _makeAvatarState = () => ({
                targeted: false,
              });
              const avatarStates = {
                left: _makeAvatarState(),
                right: _makeAvatarState(),
              };
              const avatarState = {
                text: `Welcome to Zeo! I'm Zee and I'll be your guide.`,
                textIndex: 0,
              };

              const mesh = (() => {
                const result = new THREE.Object3D();
                result.position.x = -1;

                const solidMaterial = new THREE.MeshPhongMaterial({
                  color: 0x4CAF50,
                  shininess: 10,
                  shading: THREE.FlatShading,
                });

                const head = (() => {
                  const geometry = hexahedronGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.y = 1;
                  mesh.position.z = 0.4;
                  mesh.rotation.order = camera.rotation.order;
                  mesh.scale.set(0.8, 0.8, 3);
                  return mesh;
                })();
                result.add(head);
                result.head = head;

                const body = (() => {
                  const geometry = pyramidGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.y = 0.9;
                  mesh.scale.set(2, 3, 5);
                  return mesh;
                })();
                result.add(body);
                result.body = body;

                const leftArm = (() => {
                  const geometry = triangleGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(-0.15, 0.75, 0.25);
                  mesh.scale.set(0.5, 0.75, 2.5);
                  return mesh;
                })();
                result.add(leftArm);
                result.leftArm = leftArm;

                const rightArm = (() => {
                  const geometry = triangleGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(0.15, 0.75, 0.25);
                  mesh.scale.set(0.5, 0.75, 2.5);
                  return mesh;
                })();
                result.add(rightArm);
                result.rightArm = rightArm;

                const tail = (() => {
                  const geometry = longGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.y = 0.9;
                  mesh.position.z = -0.55;
                  mesh.scale.set(1.5, 3, 5);
                  return mesh;
                })();
                result.add(tail);
                result.tail = tail;

                const leftLeg = (() => {
                  const geometry = tallGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(0.2, 0.6, -0.225);
                  mesh.scale.set(2, 3, 1);
                  return mesh;
                })();
                result.add(leftLeg);
                result.leftLeg = leftLeg;

                const rightLeg = (() => {
                  const geometry = tallGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(-0.2, 0.6, -0.225);
                  mesh.scale.set(-2, 3, 1);
                  return mesh;
                })();
                result.add(rightLeg);
                result.rightLeg = rightLeg;

                return result;
              })();
              entityObject.add(mesh);
              entityApi.mesh = mesh;

              const planeMesh = (() => {
                const menuUi = ui.makeUi({
                  width: WIDTH,
                  height: HEIGHT,
                  color: [1, 1, 1, 0],
                });
                const mesh = menuUi.addPage(({
                  avatar: avatarState,
                }) => ({
                  type: 'html',
                  src: menuRenderer.getAvatarSrc({
                    avatar: avatarState,
                  }),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: HEIGHT,
                }), {
                  type: 'avatar',
                  state: {
                    avatar: avatarState,
                  },
                  worldWidth: WORLD_WIDTH,
                  worldHeight: WORLD_HEIGHT,
                });
                mesh.rotation.order = camera.rotation.order;

                return mesh;
              })();
              entityObject.add(planeMesh);
              entityObject.planeMesh = planeMesh;

              const headProxy = new THREE.Object3D();
              headProxy.rotation.order = camera.rotation.order;

              let cancelDialog = null;
              const _toggleDialog = () => {
                if (!cancelDialog) {
                  avatarState.textIndex = 0;

                  let audio = null;
                  let timeout = null;
                  const _recurse = () => {
                    const {text, textIndex} = avatarState;

                    if (textIndex < text.length) {
                      audio = audios[Math.floor(Math.random() * audios.length)];
                      audio.currentTime = 0;
                      audio.play();

                      timeout = setTimeout(() => {
                        avatarState.textIndex++;

                        const {page} = planeMesh;
                        page.update();

                        _recurse();
                      }, 20 + (Math.random() * (150 - 20)));
                    } else {
                      if (cancelDialog) {
                        cancelDialog();

                        cancelDialog = null;
                      }
                    }
                  };
                  _recurse();

                  cancelDialog = () => {
                    audio.pause();

                    clearTimeout(timeout);
                  };
                } else {
                  cancelDialog();

                  cancelDialog = null;
                }
              };

              const boxMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
                const material = wireframeMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.x = -1;
                mesh.position.y = 0.5;
                mesh.visible = false;
                return mesh;
              })();
              entityObject.add(boxMesh);

              const boxTarget = geometryUtils.makeBoxTarget(new THREE.Vector3(-1, 0.5, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1));

              const _trigger = e => {
                const {side} = e;
                const avatarState = avatarStates[side];
                const {targeted} = avatarState;

                if (targeted) {
                  _toggleDialog();
                }
              };
              input.on('trigger', _trigger);

              const _update = () => {
                const {gamepads} = pose.getStatus();

                const _updateTargets = () => {
                  SIDES.forEach(side => {
                    const avatarState = avatarStates[side];

                    const targeted = (() => {
                      const gamepad = gamepads[side];

                      if (gamepad) {
                        const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                        const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation);

                        const intersectionPoint = boxTarget.intersectLine(controllerLine);
                        return intersectionPoint !== null;
                      } else {
                        return false;
                      }
                    })();
                    avatarState.targeted = targeted;
                  });
                  const targeted = SIDES.some(side => avatarStates[side].targeted);
                  boxMesh.visible = targeted;
                };
                const _updateAvatar = () => {
                  const {head} = mesh;
                  const {position: headPosition} = _decomposeObjectMatrixWorld(head);
                  headProxy.position.copy(headPosition);
                  headProxy.lookAt(camera.position);

                  headProxy.rotation.x = _clamp(headProxy.rotation.x, -Math.PI / 2, Math.PI / 2);
                  headProxy.rotation.y = _clamp(headProxy.rotation.y, -Math.PI / 2, Math.PI / 2);

                  head.rotation.copy(headProxy.rotation);

                  planeMesh.position.copy(
                    headProxy.position.clone().add(new THREE.Vector3(0, 0.3, 0.2).applyEuler(headProxy.rotation))
                  );
                  planeMesh.rotation.y = headProxy.rotation.y;
                };

                _updateTargets();
                _updateAvatar();
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(mesh);

                render.removeListener('update', _update);
              };
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();

              switch (name) {
                /* case 'position': { // XXX re-enable this
                  const position = newValue;

                  if (position) {
                    const {mesh} = entityApi;

                    mesh.position.set(position[0], position[1], position[2]);
                    mesh.quaternion.set(position[3], position[4], position[5], position[6]);
                    mesh.scale.set(position[7], position[8], position[9]);
                  }

                  break;
                } */
              }
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
          };
          elements.registerComponent(this, raptorComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, raptorComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _clamp = (v, min, max) => Math.min(Math.max(v, min), max);

module.exports = Raptor;
