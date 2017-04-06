const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');
const menuRenderer = require('./lib/render/menu');

const mod = require('mod-loop');
const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

const AVATAR_TEXT = `Welcome to Zeo! I'm Zee and I'll be your guide. Click the checkmark below to continue.`;
const AUDIO_FILES = [
  '03.ogg',
  '08.ogg',
  '09.ogg',
  '65.ogg',
];
const MESH_OFFSET = -1;
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
          const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

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
          const quentahedronGeometry = (() => {
            const points = [
              new THREE.Vector3(0, 0.1, 0),
              new THREE.Vector3(-0.1, 0, 0),
              new THREE.Vector3(0.1, 0, 0),
              new THREE.Vector3(0, 0, 0.1 / sqrt2),
              new THREE.Vector3(0, 0, -0.1 / sqrt2),
            ];
            return new THREEConvexGeometry(points);
          })();
          const tetrahedronGeometry = (() => {
            const points = [
              new THREE.Vector3(-0.1, 0, 0),
              new THREE.Vector3(0.1, 0, 0),
              new THREE.Vector3(0, -0.1, 0),
              new THREE.Vector3(0, 0, 0.1 / sqrt2),
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
          const tallGeometryLeft = (() => {
            const points = [
              new THREE.Vector3(0, 0.05, 0.1),
              new THREE.Vector3(0, 0.1, -0.1),
              new THREE.Vector3(-0.075, 0, 0),
              new THREE.Vector3(0, -0.2, -0.1),
            ];
            return new THREEConvexGeometry(points);
          })();
          const tallGeometryRight = (() => {
            const points = [
              new THREE.Vector3(0, 0.05, 0.1),
              new THREE.Vector3(0, 0.1, -0.1),
              new THREE.Vector3(0.075, 0, 0),
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
          const solidMaterial = new THREE.MeshPhongMaterial({
            color: 0x4CAF50,
            shininess: 10,
            shading: THREE.FlatShading,
          });

          const avatarHoverStates = {
            left: ui.makeMenuHoverState(),
            right: ui.makeMenuHoverState(),
          };

          const avatarDotMeshes = {
            left: ui.makeMenuDotMesh(),
            right: ui.makeMenuDotMesh(),
          };
          scene.add(avatarDotMeshes.left);
          scene.add(avatarDotMeshes.right);

          const avatarBoxMeshes = {
            left: ui.makeMenuBoxMesh(),
            right: ui.makeMenuBoxMesh(),
          };
          scene.add(avatarBoxMeshes.left);
          scene.add(avatarBoxMeshes.right);

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
                text: '',
                textIndex: 0,
              };

              const mesh = (() => {
                const result = new THREE.Object3D();
                result.position.x = MESH_OFFSET;
                result.rotation.order = camera.rotation.order;

                const headBase = (() => {
                  const object = new THREE.Object3D();
                  object.position.y = 1;
                  object.position.z = 0.4;
                  object.rotation.order = camera.rotation.order;
                  return object;
                })();
                result.add(headBase);
                result.headBase = headBase;

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
                  const geometry = tallGeometryLeft.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(0.2, 0.6, -0.225);
                  mesh.scale.set(2, 3, 1);
                  return mesh;
                })();
                result.add(leftLeg);
                result.leftLeg = leftLeg;

                const rightLeg = (() => {
                  const geometry = tallGeometryRight.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(-0.2, 0.6, -0.225);
                  mesh.scale.set(2, 3, 1);
                  return mesh;
                })();
                result.add(rightLeg);
                result.rightLeg = rightLeg;

                return result;
              })();
              entityObject.add(mesh);
              entityApi.mesh = mesh;

              const head = (() => {
                const object = new THREE.Object3D();
                object.rotation.order = camera.rotation.order;

                const top = (() => {
                  const geometry = quentahedronGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.scale.set(0.8, 0.8, 3);
                  return mesh;
                })();
                object.add(top);

                const mouth = (() => {
                  const geometry = tetrahedronGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  // mesh.position.y = -0.01;
                  // mesh.position.z = 0.01;
                  // mesh.scale.set(0.75, 0.75, 2.5);
                  mesh.scale.set(0.8, 0.8, 3);
                  return mesh;
                })();
                object.add(mouth);
                object.mouth = mouth;

                const neck = (() => {
                  const geometry = tetrahedronGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  // mesh.position.y = -0.02;
                  // mesh.position.z = -0.1;
                  mesh.rotation.order = camera.rotation.order;
                  mesh.scale.set(0.8, 0.8, -3);
                  return mesh;
                })();
                object.add(neck);

                return object;
              })();
              scene.add(head);

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
                mesh.visible = false;

                return mesh;
              })();
              scene.add(planeMesh);

              const soundBody = (() => {
                const result = sound.makeBody();
                result.setInputElements(audios);
                result.setObject(head);
                return result;
              })();

              let animationStartWorldTime = null;
              let cancelDialog = null;
              const _setTextIndex = v => {
                avatarState.textIndex = v;

                const {page} = planeMesh;
                page.update();
              };
              const _toggleDialog = () => {
                if (!cancelDialog) {
                  avatarState.text = AVATAR_TEXT;

                  _setTextIndex(0);

                  let audio = null;
                  let timeout = null;
                  const _recurse = () => {
                    const {text, textIndex} = avatarState;

                    if (textIndex < text.length) {
                      audio = audios[Math.floor(Math.random() * audios.length)];
                      audio.currentTime = 0;
                      audio.play();

                      timeout = setTimeout(() => {
                        _setTextIndex(textIndex + 1);

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

                  animationStartWorldTime = world.getWorldTime();

                  cancelDialog = () => {
                    audio.pause();

                    clearTimeout(timeout);

                    animationStartWorldTime = null;
                  };
                } else {
                  cancelDialog();

                  cancelDialog = null;

                  avatarState.text = '';
                  _setTextIndex(0);
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

                const _doPlaneClick = () => {
                  const avatarHoverState = avatarHoverStates[side];
                  const {anchor} = avatarHoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  if (onclick === 'avatar:next') {
                    avatarState.text = '';
                    avatarState.textIndex = 0;

                    const {page} = planeMesh;
                    page.update();
                  }
                };
                const _doAvatarClick = () => {
                  const avatarState = avatarStates[side];
                  const {targeted} = avatarState;

                  if (targeted) {
                    _toggleDialog();

                    return true;
                  } else {
                    return false;
                  }
                };

                _doPlaneClick() || _doAvatarClick();
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
                const _updateAvatarGaze = () => {
                  const {headBase} = mesh;
                  const {position: headBasePosition, rotation: headBaseQuaternion} = _decomposeObjectMatrixWorld(headBase);
                  const headBaseRotation = new THREE.Euler().setFromQuaternion(headBaseQuaternion, camera.rotation.order);

                  head.position.copy(headBasePosition);
                  head.lookAt(camera.position);
                  head.rotation.x = _clampHalfSphereAngle(head.rotation.x - headBaseRotation.x) + headBaseRotation.x;
                  head.rotation.y = _clampHalfSphereAngle(head.rotation.y - headBaseRotation.y) + headBaseRotation.y;

                  planeMesh.position.copy(
                    head.position.clone().add(new THREE.Vector3(0, 0.3, 0.2).applyEuler(head.rotation))
                  );
                  planeMesh.rotation.y = head.rotation.y;

                  const {mouth} = head;
                  mouth.rotation.x = soundBody.getAmplitude() * Math.PI * 0.4;
                };
                const _updateAvatarAnimation = () => {
                  const {leftLeg, rightLeg} = mesh;

                  if (animationStartWorldTime !== null) {
                    const currentWorldTime = world.getWorldTime();
                    const worldTimeDiff = currentWorldTime - animationStartWorldTime;
                    const worldTimeDiffSeconds = worldTimeDiff / 1000;

                    const moveAnimationTime = 5;
                    const moveAnimationScale = 2;
                    const worldTimeDiffSecondsMod = worldTimeDiffSeconds % moveAnimationTime;
                    const moveAnimationDirection = (worldTimeDiffSecondsMod < (moveAnimationTime / 2)) ? 'forward' : 'back'
                    const moveAnimationFactor = (() => {
                      if (moveAnimationDirection === 'forward') {
                        return worldTimeDiffSecondsMod / (moveAnimationTime / 2);
                      } else if (moveAnimationDirection === 'back') {
                        return 1 -((worldTimeDiffSecondsMod - (moveAnimationTime / 2)) / (moveAnimationTime / 2));
                      }
                    })();
                    if (moveAnimationDirection === 'forward') {
                      mesh.rotation.y = Math.PI / 2;
                    } else if (moveAnimationDirection === 'back') {
                      mesh.rotation.y = -Math.PI / 2;
                    }
                    mesh.position.x = MESH_OFFSET + (moveAnimationFactor * moveAnimationScale);

                    const legAnimationFactor = Math.sin(worldTimeDiffSeconds * (Math.PI * 2));
                    leftLeg.rotation.x = legAnimationFactor * Math.PI * 0.3;
                    rightLeg.rotation.x = -legAnimationFactor * Math.PI * 0.3;
                  } else {
                    mesh.position.x = MESH_OFFSET;
                    mesh.rotation.y = 0;

                    leftLeg.rotation.x = 0;
                    rightLeg.rotation.x = 0;
                  }
                };
                const _updatePlane = () => {
                  const {text} = avatarState;

                  if (text) {
                    const {gamepads} = pose.getStatus();

                    const matrixObject = _decomposeObjectMatrixWorld(planeMesh);
                    const {page} = planeMesh;

                    SIDES.forEach(side => {
                      const gamepad = gamepads[side];

                      if (gamepad) {
                        const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                        const avatarHoverState = avatarHoverStates[side];
                        const avatarDotMesh = avatarDotMeshes[side];
                        const avatarBoxMesh = avatarBoxMeshes[side];

                        ui.updateAnchors({
                          objects: [{
                            matrixObject: matrixObject,
                            page: page,
                            width: WIDTH,
                            height: HEIGHT,
                            worldWidth: WORLD_WIDTH,
                            worldHeight: WORLD_HEIGHT,
                            worldDepth: WORLD_DEPTH,
                          }],
                          hoverState: avatarHoverState,
                          dotMesh: avatarDotMesh,
                          boxMesh: avatarBoxMesh,
                          controllerPosition,
                          controllerRotation,
                        });
                      }
                    });

                    planeMesh.visible = true;
                  } else {
                    SIDES.forEach(side => {
                      const avatarDotMesh = avatarDotMeshes[side];
                      avatarDotMesh.visible = false;

                      const avatarBoxMesh = avatarBoxMeshes[side];
                      avatarBoxMesh.visible = false;
                    });

                    planeMesh.visible = false;
                  }
                };

                _updateTargets();
                _updateAvatarGaze();
                _updateAvatarAnimation();
                _updatePlane();
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(mesh);

                scene.remove(head);
                scene.remove(planeMesh);

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
            SIDES.forEach(side => {
              scene.add(avatarDotMeshes[side]);
              scene.add(avatarBoxMeshes[side]);
            });

            elements.unregisterComponent(this, raptorComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _clampHalfSphereAngle = v => {
  v = mod(v, Math.PI * 2);
  if (v > (Math.PI / 2) && v <= Math.PI) {
    v = Math.PI / 2;
  } else if (v > Math.PI && v < (Math.PI * 3 / 2)) {
    v = Math.PI * 3 / 2;
  }
  return v;
};

module.exports = Raptor;
