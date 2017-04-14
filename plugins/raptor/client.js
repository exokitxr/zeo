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
      audio.src = 'archae/raptor/audio/' + fileName;
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

          const forwardVector = new THREE.Vector3(0, 0, 1);

          const sqrt2 = Math.sqrt(2);
          const quentahedronGeometry = new THREEConvexGeometry([
            new THREE.Vector3(0, 0.1, 0),
            new THREE.Vector3(-0.1, 0, 0),
            new THREE.Vector3(0.1, 0, 0),
            new THREE.Vector3(0, 0, 0.1 / sqrt2),
            new THREE.Vector3(0, 0, -0.1 / sqrt2),
          ]);
          const tetrahedronGeometry = new THREEConvexGeometry([
            new THREE.Vector3(-0.1, 0, 0),
            new THREE.Vector3(0.1, 0, 0),
            new THREE.Vector3(0, -0.1, 0),
            new THREE.Vector3(0, 0, 0.1 / sqrt2),
          ]);
          const tetrahedronInverseGeometry = new THREEConvexGeometry([
            new THREE.Vector3(-0.1, 0, 0),
            new THREE.Vector3(0.1, 0, 0),
            new THREE.Vector3(0, -0.1, 0),
            new THREE.Vector3(0, 0, -0.1 / sqrt2),
          ]);
          const pyramidGeometry = new THREEConvexGeometry([
            new THREE.Vector3(-0.1, 0, -0.1),
            new THREE.Vector3(0.1, 0, -0.1),
            new THREE.Vector3(0, 0, 0.1 / sqrt2),
            new THREE.Vector3(0, -0.1, 0),
          ]);
          const triangleGeometry = new THREEConvexGeometry([
            new THREE.Vector3(0, 0.1, 0),
            new THREE.Vector3(-0.1, 0, 0),
            new THREE.Vector3(0.1, 0, 0),
            new THREE.Vector3(0, 0, 0.1 / sqrt2),
            new THREE.Vector3(0, 0, -0.1 / sqrt2),
          ]);
          const longGeometry = new THREEConvexGeometry([
            new THREE.Vector3(-0.1, 0, 0),
            new THREE.Vector3(0.1, 0, 0),
            new THREE.Vector3(0, -0.05, 0.05),
            new THREE.Vector3(0, 0, -0.2),
          ]);
          const tallGeometryLeft = new THREEConvexGeometry([
            new THREE.Vector3(0, 0.05, 0.1),
            new THREE.Vector3(0, 0.1, -0.1),
            new THREE.Vector3(-0.075, 0, 0),
            new THREE.Vector3(0, -0.2, -0.1),
          ]);
          const tallGeometryRight = new THREEConvexGeometry([
            new THREE.Vector3(0, 0.05, 0.1),
            new THREE.Vector3(0, 0.1, -0.1),
            new THREE.Vector3(0.075, 0, 0),
            new THREE.Vector3(0, -0.2, -0.1),
          ]);
          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });
          const solidMaterial = new THREE.MeshPhongMaterial({
            color: 0xF44336,
            shininess: 10,
            shading: THREE.FlatShading,
          });

          const scripts = (() => {
            const _button = s => `<span style="display: inline-block; margin: 0 5px; padding: 0 5px; border: 1px solid; border-radius: 5px;">${s}</span>`;

            return [
              {
                html: `Welcome to Zeo! I'm Zee and I'll be your guide. Click the checkmark below to continue.`,
                startPosition: new THREE.Vector3(-1, 0, 0),
                endPosition: new THREE.Vector3(1, 0, 0),
              },
              {
                html: `You're using a mouse and keyboard, so use ${_button('W')}${_button('A')}${_button('S')}${_button('D')} to move and ${_button('LMB')} to click.`,
                endPosition: new THREE.Vector3(1, 0, 1),
              },
              {
                html: `<div style="position: relative; width: ${WIDTH}; height: ${HEIGHT}px;">
                  <div style="display: flex; position: absolute; top: 0; left: 0; width: 100px; height: 100px; font-size: 100px; font-weight: 600; line-height: 1; justify-content: center; align-items: center;">!</div>
                  <div style="position: absolute; top: 0; left: 100px; right: 30px;">Whoa, the floor is gone! See if you can add a new floor to the world.</div>
                </div>`,
                gazeTarget: new THREE.Vector3(0, -10, 0),
              },
            ];
          })();

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

              const _makeAvatarSideState = () => ({
                targeted: false,
              });
              const avatarSideStates = {
                left: _makeAvatarSideState(),
                right: _makeAvatarSideState(),
              };
              const avatarState = {
                scriptIndex: 0,
                characterIndex: 0,
                text: '',
                done: true,
              };

              const raptorMesh = (() => {
                const result = new THREE.Object3D();
                result.position.copy(scripts[0].startPosition);
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
              entityObject.add(raptorMesh);
              entityApi.raptorMesh = raptorMesh;

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
                  const geometry = tetrahedronInverseGeometry.clone();
                  const material = solidMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  // mesh.position.y = -0.02;
                  // mesh.position.z = -0.1;
                  mesh.rotation.order = camera.rotation.order;
                  mesh.scale.set(0.8, 0.8, 3);
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
                  type: 'raptor',
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

              const _updateText = () => {
                const {scriptIndex, characterIndex} = avatarState;

                const script = scripts[scriptIndex];
                const {html} = script;
                const {text, done} = _sliceHtml(html, characterIndex);
                avatarState.text = text;
                avatarState.done = done;

                const {page} = planeMesh;
                page.update();
              };
              _updateText();

              let animationSpec = null;
              const _playScript = () => {
                const {scriptIndex: scriptIndex2} = avatarState;

                avatarState.characterIndex = 0;
                _updateText();

                let audio = null;
                let timeout = null;
                const _recurse = () => {
                  const {done} = avatarState;

                  if (!done) {
                    audio = audios[Math.floor(Math.random() * audios.length)];
                    audio.currentTime = 0;
                    audio.play();

                    timeout = setTimeout(() => {
                      avatarState.characterIndex++;
                      _updateText();

                      _recurse();
                    }, 20 + (Math.random() * (150 - 20)));
                  } else {
                    if (timeout) {
                      timeout = null;
                    }

                    animationSpec.unref();
                  }
                };
                _recurse();

                const {scriptIndex} = avatarState;
                const script = scripts[scriptIndex];
                const {gazeTarget = null, endPosition = null} = script;
                let refcount = 2;
                animationSpec = {
                  startTime: world.getWorldTime(),
                  startPosition: raptorMesh.position.clone(),
                  gazeTarget: gazeTarget,
                  endPosition: endPosition,
                  unref: () => {
                    if (--refcount === 0) {
                      animationSpec = null;
                    }
                  },
                  /* cancel: () => {
                    if (!audio.paused) {
                      audio.pause();
                    }
                    if (timeout) {
                      clearTimeout(timeout);
                    }

                    animationSpec = null;
                  }, */
                };
              };

              const boxMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
                const material = wireframeMaterial;

                const result = new THREE.Mesh(geometry, material);
                result.position.copy(raptorMesh.position);
                result.position.y += 0.5;
                result.visible = false;
                return result;
              })();
              entityObject.add(boxMesh);

              const boxTarget = geometryUtils.makeBoxTarget(
                scripts[0].startPosition.clone().add(new THREE.Vector3(0, 0.5, 0)),
                new THREE.Quaternion(),
                new THREE.Vector3(1, 1, 1),
                new THREE.Vector3(1, 1, 1)
              );

              const _trigger = e => {
                const {side} = e;

                const _doPlaneClick = () => {
                  const avatarHoverState = avatarHoverStates[side];
                  const {anchor} = avatarHoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  if (onclick === 'avatar:next') {
                    const {scriptIndex} = avatarState;

                    if ((scriptIndex + 1) < scripts.length) {
                      avatarState.scriptIndex = scriptIndex + 1;

                      _playScript();
                    } else {
                      avatarState.scriptIndex = 0;
                      avatarState.characterIndex = 0;
                      _updateText();
                    }
                  }
                };
                const _doAvatarClick = () => {
                  const avatarSideState = avatarSideStates[side];
                  const {targeted} = avatarSideState;

                  if (targeted) {
                    avatarState.scriptIndex = 0;

                    _playScript();

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
                    const avatarSideState = avatarSideStates[side];

                    const targeted = (() => {
                      if (animationSpec === null) {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;
                          const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);

                          const intersectionPoint = boxTarget.intersectLine(controllerLine);
                          return intersectionPoint !== null;
                        } else {
                          return false;
                        }
                      } else {
                        return false;
                      }
                    })();
                    avatarSideState.targeted = targeted;
                  });
                  const targeted = SIDES.some(side => avatarSideStates[side].targeted);
                  boxMesh.visible = targeted;
                };
                const _updateAvatarGaze = () => {
                  const {headBase} = raptorMesh;
                  const {position: headBasePosition, rotation: headBaseQuaternion} = _decomposeObjectMatrixWorld(headBase);
                  const headBaseRotation = new THREE.Euler().setFromQuaternion(headBaseQuaternion, camera.rotation.order);

                  head.position.copy(headBasePosition);
                  const gazeTarget = ((animationSpec !== null) ? animationSpec.gazeTarget : null) || camera.position;
                  head.lookAt(gazeTarget);
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
                  const moveSpeed = 0.001;
                  const legAnimationTime = 3 * 1000;

                  if (animationSpec !== null) {
                    const currentWorldTime = world.getWorldTime();
                    const {startTime} = animationSpec;
                    const worldTimeDiff = currentWorldTime - startTime;
                    // const worldTimeDiffSeconds = worldTimeDiff / 1000;

                    const {startPosition, endPosition} = animationSpec;
                    if (endPosition !== null) {
                      const moveVector = endPosition.clone().sub(startPosition);
                      const moveTime = moveVector.length() / moveSpeed;
                      const moveFactor = worldTimeDiff / moveTime;

                      const {leftLeg, rightLeg} = raptorMesh;

                      if (moveFactor < 1) {
                        raptorMesh.position.copy(
                          startPosition.clone().add(moveVector.multiplyScalar(moveFactor))
                        );
                        raptorMesh.quaternion.setFromUnitVectors(forwardVector, moveVector.clone().normalize());

                        const legAnimationFactor = Math.sin((worldTimeDiff / legAnimationTime) * (Math.PI * 2));
                        leftLeg.rotation.x = legAnimationFactor * Math.PI * 0.3;
                        rightLeg.rotation.x = -legAnimationFactor * Math.PI * 0.3;
                      } else {
                        raptorMesh.position.copy(endPosition);
                        raptorMesh.quaternion.setFromUnitVectors(forwardVector, moveVector.clone().normalize());

                        leftLeg.rotation.x = 0;
                        rightLeg.rotation.x = 0;

                        animationSpec.endPosition = null;
                        animationSpec.unref();
                      }
                    }
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
                        const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;

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
                          controllerScale,
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
                entityObject.remove(raptorMesh);

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
                    const {raptorMesh} = entityApi;

                    raptorMesh.position.set(position[0], position[1], position[2]);
                    raptorMesh.quaternion.set(position[3], position[4], position[5], position[6]);
                    raptorMesh.scale.set(position[7], position[8], position[9]);
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
              scene.remove(avatarDotMeshes[side]);
              scene.remove(avatarBoxMeshes[side]);
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
const _sliceHtml = (html, characterIndex) => {
  html = html.replace(/(\s)\s+/g, '$1');

  let result = '';
  let numTextCharacters = 0;
  let i = 0;
  for (; i < html.length && numTextCharacters < characterIndex; i++) {
    const c = html.charAt(i);

    if (c !== '<') {
      result += c;
      numTextCharacters++;
    } else {
      for (; i < html.length; i++) {
        const c = html.charAt(i);

        result += c;

        if (c === '>') {
          break;
        }
      }
    }
  }

  const done = !(i < html.length);

  return {
    text: result,
    done: done,
  };
};

module.exports = Raptor;
