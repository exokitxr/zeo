const mod = require('mod-loop');

const PIXEL_SIZE = 0.008;
const TRANSITION_DURATION = 1000;

const GIT_HASH = '9ed4f16e002c737435912377813aeac0e8c94fb7';

const ICON_IMG_URL = `https://cdn.rawgit.com/modulesio/zeo-data/${GIT_HASH}/img/icons/nyancat.png`;
const STAR_IMG_URLS = (() => {
  const numUrls = 7;
  const result = Array(numUrls)
  for (let i = 0; i < numUrls; i++) {
    result[i] = `https://cdn.rawgit.com/modulesio/zeo-data/${GIT_HASH}/img/icons/nyancat-star${i + 1}.png`;
  }
  return result;
})();
const AUDIO_URL = `https://cdn.rawgit.com/modulesio/zeo-data/${GIT_HASH}/audio/nyancat-loop.ogg`;
const AD_IMG_URL = `https://cdn.rawgit.com/modulesio/zeo-data/${GIT_HASH}/img/text/ad.png`;
const CLOSE_IMG_URL = `https://cdn.rawgit.com/modulesio/zeo-data/${GIT_HASH}/img/text/close.png`;
const YOUR_THING_HERE_IMG_URL = `https://cdn.rawgit.com/modulesio/zeo-data/${GIT_HASH}/img/text/yourthinghere.png`;
const CLICK_IMG_URL = `https://cdn.rawgit.com/modulesio/zeo-data/${GIT_HASH}/img/text/click.png`;
const SUPPORT_IMG_URL = `https://cdn.rawgit.com/modulesio/zeo-data/${GIT_HASH}/img/text/support.png`;

const FRAME_INTERVAL = 50;
const STARS_FRAME_SKIP = 4;
const HIGHLIGHT_LOOP_FRAMES = 20;
const HIGHLIGHT_FRAME_RATIO = 1 / 3;

const SIDES = ['left', 'right'];

module.exports = archae => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImg = url => new Promise((accept, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = url;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });
    const _requestIconImg = () => _requestImg(ICON_IMG_URL);
    const _requestStarImgs = () => Promise.all(STAR_IMG_URLS.map(starImgUrl => _requestImg(starImgUrl)));
    const _requestAdImg = () => _requestImg(AD_IMG_URL);
    const _requestCloseImg = () => _requestImg(CLOSE_IMG_URL);
    const _requestYourThingHereImg = () => _requestImg(YOUR_THING_HERE_IMG_URL);
    const _requestClickImg = () => _requestImg(CLICK_IMG_URL);
    const _requestSupportImg = () => _requestImg(SUPPORT_IMG_URL);
    const _requestAudio = () => new Promise((accept, reject) => {
      const audio = document.createElement('audio');
      audio.src = AUDIO_URL;
      audio.loop = true;
      audio.crossOrigin = 'Anonymous';
      audio.oncanplay = () => {
        accept(audio);
      };
      audio.onerror = err => {
        reject(err);
      };
    });
    const _requestResources = () => Promise.all([
      _requestIconImg(),
      _requestStarImgs(),
      _requestAdImg(),
      _requestCloseImg(),
      _requestYourThingHereImg(),
      _requestClickImg(),
      _requestSupportImg(),
    ]).then(([
      iconImg,
      starImgs,
      adImg,
      closeImg,
      yourThingHereImg,
      clickImg,
      supportImg,
    ]) => ({
      iconImg,
      starImgs,
      adImg,
      closeImg,
      yourThingHereImg,
      clickImg,
      supportImg,
    }));

    return _requestResources()
      .then(({
        iconImg,
        starImgs,
        adImg,
        closeImg,
        yourThingHereImg,
        clickImg,
        supportImg,
        audio,
      }) => {
        if (live) {
          const {three: {THREE, scene, camera, sound}, elements, pose, input, render, world, animation, utils: {geometry: geometryUtils, sprite: spriteUtils, random: {alea}}} = zeo;

          const starGeometries = starImgs.map(starImg => spriteUtils.makeImageGeometry(starImg, PIXEL_SIZE));
          const textMaterialDark = new THREE.MeshPhongMaterial({
            color: 0x000000,
            shininess: 10,
          });
          const textMaterialLight = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF,
            shininess: 10,
          });
          const textMaterialGray = new THREE.MeshPhongMaterial({
            color: 0xCCCCCC,
            shininess: 10,
          });
          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xCCCCCC,
            wireframe: true,
          });
          const pixelMaterial = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF,
            shininess: 10,
            vertexColors: THREE.FaceColors,
          });
          const backgroundMaterial = new THREE.MeshPhongMaterial({
            color: 0x003466,
            shininess: 10,
            side: THREE.DoubleSide,
            opacity: 0.9,
            transparent: true,
          });
          const pointsMaterial = new THREE.PointsMaterial({
            color: 0x000000,
            size: 0.01,
          });

          const _decomposeObjectMatrixWorld = object => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            object.matrixWorld.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          class DemoAdElement extends HTMLElement {
            createdCallback() {
              const adState = {
                open: true,
                animation: null,
              };
              const _makeHoverState = () => ({
                target: null,
              });
              const hoverStates = {
                left: _makeHoverState(),
                right: _makeHoverState(),
              };

              const mesh = (() => {
                const object = new THREE.Object3D();

                const rng = new alea('');

                const adMesh = (() => {
                  const shape = new THREE.Shape();
                  shape.moveTo(0, 0);
                  shape.lineTo(0, 0.4 * 0.2);
                  shape.lineTo(0.1 * 0.2, 0.5 * 0.2);
                  shape.lineTo(0.9 * 0.2, 0.5 * 0.2);
                  shape.lineTo(1 * 0.2, 0.4 * 0.2);
                  shape.lineTo(1* 0.2 , 0);
                  shape.lineTo(0, 0);
                  const extrudeSettings = {
                    steps: 1,
                    amount: 0.01,
                    bevelEnabled: false,
                  };
                  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                  const material = new THREE.MeshPhongMaterial({
                    color: 0xCCCCCC,
                    shininess: 10,
                  });
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(-0.5, 0.5, 0.5 - 0.01);

                  const adTextMesh = (() => {
                    const geometry = spriteUtils.makeImageGeometry(adImg, PIXEL_SIZE * 1.5);
                    const material = textMaterialDark;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.x = 0.2 / 2;
                    mesh.position.y = 0.1 / 2;
                    mesh.position.z = 0.01;
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  mesh.add(adTextMesh);

                  return mesh;
                })();
                object.add(adMesh);

                const closeMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(0.3, 0.1, 0.01);
                  const material = new THREE.MeshPhongMaterial({
                    color: 0x800000,
                    shininess: 10,
                  });
                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(0.5 - (0.3 / 2), 0.5 + (0.1 / 2), 0.5 - (0.01 / 2));

                  const closeTextMesh = (() => {
                    const geometry = spriteUtils.makeImageGeometry(closeImg, PIXEL_SIZE * 1.5);
                    const material = textMaterialLight;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.z = 0.01;
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  mesh.add(closeTextMesh);

                  return mesh;
                })();
                object.add(closeMesh);
                object.closeMesh = closeMesh;

                const boxMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
                  const material = wireframeMaterial;

                  return new THREE.Mesh(geometry, material);
                })();
                object.add(boxMesh);

                const yourThingHereMesh = (() => {
                  const geometry = spriteUtils.makeImageGeometry(yourThingHereImg, PIXEL_SIZE * 2);
                  const material = new THREE.MeshPhongMaterial({
                    color: 0xCCCCCC,
                    shininess: 10,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.y = 0.25;
                  // mesh.position.z = 0.1;
                  mesh.castShadow = true;
                  return mesh;
                })();
                object.add(yourThingHereMesh);
                object.yourThingHereMesh = yourThingHereMesh;

                const nyancatMesh = (() => {
                  const geometry = spriteUtils.makeImageGeometry(iconImg, PIXEL_SIZE);
                  const material = pixelMaterial;

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.castShadow = true;
                  return mesh;
                })();
                object.add(nyancatMesh);

                const clickMesh = (() => {
                  const geometry = spriteUtils.makeImageGeometry(clickImg, PIXEL_SIZE * 1.5);
                  const material = new THREE.MeshPhongMaterial({
                    color: 0xCCCCCC,
                    shininess: 10,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.y = -0.175;
                  // mesh.position.z = 0.1;
                  mesh.castShadow = true;
                  return mesh;
                })();
                object.add(clickMesh);

                const supportMesh = (() => {
                  const geometry = spriteUtils.makeImageGeometry(supportImg, PIXEL_SIZE * 1);
                  const material = textMaterialGray;

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.y = -0.35;
                  // mesh.position.z = 0.1;
                  mesh.castShadow = true;
                  return mesh;
                })();
                object.add(supportMesh);

                const backgroundMesh = (() => {
                  const geometry = new THREE.PlaneBufferGeometry(1, 1, 1);
                  const material = backgroundMaterial;

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.castShadow = true;
                  return mesh;
                })();
                object.add(backgroundMesh);

                const starMeshes = (() => {
                  const numStars = 32;
                  const width = 125;
                  const height = 125;
                  const depth = 125;

                  const result = Array(numStars);
                  for (let i = 0; i < numStars; i++) {
                    const starMesh = (() => {
                      const geometry = starGeometries[Math.floor(rng() * starGeometries.length)].clone();
                      const material = pixelMaterial;

                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.position.set(
                        Math.floor(-(width / 2) + (rng() * width)) * PIXEL_SIZE,
                        Math.floor(-(height / 2) + (rng() * height)) * PIXEL_SIZE,
                        Math.floor(-(depth / 2) + (rng() * depth)) * PIXEL_SIZE
                      );
                      mesh.castShadow = true;
                      return mesh;
                    })();
                    result[i] = starMesh;
                  }
                  return result;
                })();
                starMeshes.forEach(starMesh => {
                  object.add(starMesh);
                });
                object.starMeshes = starMeshes;

                return object;
              })();
              scene.add(mesh);
              this.mesh = mesh;

              const _makeDotMesh = () => {
                const geometry = new THREE.BufferGeometry();
                geometry.addAttribute('position', new THREE.BufferAttribute(Float32Array.from([0, 0, 0]), 3));
                const material = pointsMaterial;

                const mesh = new THREE.Points(geometry, material);
                mesh.visible = false;
                return mesh;
              };
              const dotMeshes = {
                left: _makeDotMesh(),
                right: _makeDotMesh(),
              };
              SIDES.forEach(side => {
                scene.add(dotMeshes[side]);
              });

              let audio = null;
              const _initializeSoundBody = () => {
                _requestAudio()
                  .then(newAudio => {
                    audio = newAudio;

                    const soundBody = (() => {
                      const result = new sound.makeBody();
                      result.setInputElement(audio);
                      result.setObject(mesh);
                      return result;
                    })();
                  })
                  .catch(err => {
                    console.warn(err);
                  });
              };
              _initializeSoundBody();

              const _trigger = e => {
                const {side} = e;
                const hoverState = hoverStates[side];
                const {target} = hoverState;

                if (target) {
                  adState.open = false;
                  adState.animation = animation.makeAnimation(TRANSITION_DURATION);

                  const dotMesh = dotMeshes[side];
                  dotMesh.visible = false;
                }
              };
              input.on('trigger', _trigger);

              let lastTime = world.getWorldTime();
              const _update = () => {
                const _updateMesh = () => {
                  const {open} = adState;

                  if (!open) {
                    const {animation} = adState;
                    const factor = animation.getValue();
                    const value = 1 - factor;

                    if (value > 0) {
                       mesh.scale.set(1, value, 1);
                    } else {
                       mesh.scale.set(1, 1, 1);
                       mesh.visible = false;
                    }
                  }
                };
                const _updateControllers = () => {
                  const {gamepads} = pose.getStatus();

                  const _updateNyancatMesh = () => {
                    if (audio) {
                      const touchingNyancat = SIDES.some(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition} = gamepad;
                          return controllerPosition.distanceTo(mesh.position) < 0.1;
                        } else {
                          return false;
                        }
                      });
                      if (touchingNyancat && audio.paused) {
                        audio.play();
                      } else if (!touchingNyancat && !audio.paused) {
                        audio.pause();
                      }
                    }
                  };
                  const _updateCloseMesh = () => {
                    const {open} = adState;

                    if (open) {
                      const {closeMesh} = mesh;
                      const {position: closeMeshPosition, rotation: closeMeshRotation, scale: closeMeshScale} = _decomposeObjectMatrixWorld(closeMesh);

                      const boxTarget = geometryUtils.makeBoxTarget(closeMeshPosition, closeMeshRotation, closeMeshScale, new THREE.Vector3(0.3, 0.1, 0.01));

                      SIDES.forEach(side => {
                        const intersectionPoint = (() => {
                          const gamepad = gamepads[side];

                          if (gamepad) {
                            const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                            const controllerLine = new THREE.Line3(
                              controllerPosition,
                              controllerPosition.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(controllerRotation).multiplyScalar(15))
                            );
                            return boxTarget.intersectLine(controllerLine);
                          } else {
                            return null;
                          }
                        })();

                        const hoverState = hoverStates[side];
                        const dotMesh = dotMeshes[side];
                        if (intersectionPoint) {
                          hoverState.target = 'close';

                          dotMesh.position.copy(intersectionPoint);
                          dotMesh.visible = true;
                        } else {
                          hoverState.target = null;
                          dotMesh.visible = false;
                        }
                      });
                      const hovered = SIDES.some(side => {
                        const hoverState = hoverStates[side];
                        const {target} = hoverState;
                        return Boolean(target);
                      });
                      closeMesh.material.color = new THREE.Color(hovered ? 0xFF0000 : 0x800000);
                    }
                  };

                  _updateNyancatMesh();
                  _updateCloseMesh();
                };
                const _updateAnimations = () => {
                  const {starMeshes, yourThingHereMesh} = mesh;

                  const currentTime = world.getWorldTime();

                  const lastFrame = Math.floor(lastTime / FRAME_INTERVAL);
                  const currentFrame = Math.floor(currentTime / FRAME_INTERVAL);
                  const frameDiff = currentFrame - lastFrame;
                  if (frameDiff > 0) {
                    for (let i = 0; i < starMeshes.length; i++) {
                      const starMesh = starMeshes[i];
                      starMesh.position.x -= PIXEL_SIZE * STARS_FRAME_SKIP * frameDiff;
                      if (starMesh.position.x < -0.5) {
                        starMesh.position.x = mod(starMesh.position.x, 1);
                      }
                    }

                    if (((currentFrame / HIGHLIGHT_LOOP_FRAMES) % 1) < HIGHLIGHT_FRAME_RATIO) {
                      yourThingHereMesh.material.color.set(0xFF0000);
                      yourThingHereMesh.scale.set(1.05, 1.05, 1.05);
                    } else {
                      yourThingHereMesh.material.color.set(0xCCCCCC);
                      yourThingHereMesh.scale.set(1, 1, 1);
                    }
                  }

                  lastTime = currentTime;
                };

                _updateMesh();
                _updateControllers();
                _updateAnimations();
              };
              render.on('update', _update);

              this._cleanup = () => {
                scene.remove(mesh);
                SIDES.forEach(side => {
                  scene.remove(dotMeshes[side]);
                });

                input.removeListener('trigger', _trigger);
                input.removeListener('update', _update);

                if (audio && !audio.paused) {
                  audio.pause();
                }
              };
            }

            destructor() {
              this._cleanup();
            }

            attributeValueChangedCallback(name, oldValue, newValue) {
              switch (name) {
                case 'position': {
                  const {mesh} = this;

                  mesh.position.set(newValue[0], newValue[1], newValue[2]);
                  mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
                  mesh.scale.set(newValue[7], newValue[8], newValue[9]);

                  break;
                }
              }
            }
          }
          elements.registerElement(this, DemoAdElement); // register our element as available to the scene

          this._cleanup = () => {
            elements.unregisterElement(this);
          };
        }
      });
  },
  unmount() {
    this._cleanup();
  },
});
