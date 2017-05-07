const BULLET_RATE = 1000 / 2;
const BULLET_SPEED = 0.005;
const BULLET_TTL = 10 * 1000;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

class ZFighter {
  mount() {
    const {three: {THREE, scene, camera}, elements, input, pose, world, render, player, sound, utils: {geometry: geometryUtils}} = zeo;

    let live = true;
    this.cleanup = () => {
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

    const _requestAudio = src => new Promise((accept, reject) => {
      const audio = document.createElement('audio');

      const _cleanup = () => {
        audio.oncanplay = null;
        audio.onerror = null;
      };

      audio.oncanplay = () => {
        _cleanup();

        accept(audio);
      };
      audio.onerror = () => {
        _cleanup();

        reject(audio);
      };
      audio.crossOrigin = 'Anonymous';
      audio.src = src;
    });

    return Promise.all([
      _requestAudio('archae/z-fighter/audio/kylo1.ogg'),
      _requestAudio('archae/z-fighter/audio/kylo2.ogg')
        .then(audio => {
          audio.loop = true;
          return audio;
        }),
      _requestAudio('archae/z-fighter/audio/kylo3.ogg'),
    ])
      .then(([
        kylo1Audio,
        kylo2Audio,
        kylo3Audio,
      ]) => {
        if (live) {
          const bulletGeometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.1);
          const bulletMaterial = new THREE.MeshPhongMaterial({
            color: 0x2196F3,
            shading: THREE.FlatShading,
            transparent: true,
            opacity: 0.5,
          });
          const _makeBulletMesh = () => {
            const geometry = bulletGeometry;
            const material = bulletMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.startTime = Date.now();
            mesh.lastTime = mesh.lastTime;
            return mesh;
          };

          const fighterComponent = {
            selector: 'fighter[position]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 1.2, 0,
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

              const lightsaberMesh = (() => {
                const object = new THREE.Object3D();

                const handleMesh = (() => {
                  const geometry = (() => {
                    const sq = n => Math.sqrt((n * n) + (n * n));

                    const handleGeometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.1);
                    const crossguardGeometry = new THREE.BoxBufferGeometry(0.1, 0.02, 0.02)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.1 / 2) - (0.02 / 2)));

                    return geometryUtils.concatBufferGeometry([handleGeometry, crossguardGeometry]);
                  })();
                  const material = new THREE.MeshPhongMaterial({
                    color: 0x808080,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                object.add(handleMesh);
                object.handleMesh = handleMesh;

                const bladeMesh = (() => {
                  const geometry = (() => {
                    const coreGeometry = new THREE.BoxBufferGeometry(0.02, 0.02, 1)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.1 / 2) - 0.02 - (1 / 2)));
                    const leftGeometry = new THREE.BoxBufferGeometry(0.1, 0.02, 0.02)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(-(0.1 / 2) - (0.1 / 2), 0, -(0.1 / 2) - (0.02 / 2)));
                    const rightGeometry = new THREE.BoxBufferGeometry(0.1, 0.02, 0.02)
                      .applyMatrix(new THREE.Matrix4().makeTranslation((0.1 / 2) + (0.1 / 2), 0, -(0.1 / 2) - (0.02 / 2)));

                    return geometryUtils.concatBufferGeometry([coreGeometry, leftGeometry, rightGeometry]);
                  })();
                  const material = new THREE.MeshPhongMaterial({
                    color: 0xF44336,
                    shading: THREE.FlatShading,
                    transparent: true,
                    opacity: 0.9,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(bladeMesh);
                object.bladeMesh = bladeMesh;

                return object;
              })();
              entityObject.add(lightsaberMesh);

              const droneMesh = (() => {
                const object = new THREE.Object3D();
                object.position.y = 2;

                const coreMesh = (() => {
                  const geometry = new THREE.SphereBufferGeometry(0.25, 8, 6);
                  const material = new THREE.MeshPhongMaterial({
                    color: 0xCCCCCC,
                    shading: THREE.FlatShading,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                object.add(coreMesh);
                object.coreMesh = coreMesh;

                const eyeballMesh = (() => {
                  const geometry = new THREE.CylinderBufferGeometry(0.1, 0.1, 0.03, 8, 1)
                    .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                  const material = new THREE.MeshPhongMaterial({
                    color: 0xEEEEEE,
                    shading: THREE.FlatShading,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.z = 0.25 - 0.03;
                  mesh.rotation.y = Math.PI;
                  mesh.rotation.order = camera.rotation.order;
                  return mesh;
                })();
                object.add(eyeballMesh);
                object.eyeballMesh = eyeballMesh;

                const pupilMesh = (() => {
                  const geometry = new THREE.CylinderBufferGeometry(0.06, 0.06, 0.03, 8, 1)
                    .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                  const material = new THREE.MeshPhongMaterial({
                    color: 0x333333,
                    shading: THREE.FlatShading,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.z = 0.25 + -0.015;
                  mesh.rotation.y = Math.PI;
                  mesh.rotation.order = camera.rotation.order;
                  return mesh;
                })();
                object.add(pupilMesh);
                object.pupilMesh = pupilMesh;

                return object;
              })();
              scene.add(droneMesh);

              const soundBodies = [
                kylo1Audio,
                kylo2Audio,
                kylo3Audio,
              ].map(audio => {
                const result = sound.makeBody();

                const localAudio = audio.cloneNode();
                result.setInputElement(localAudio);
                result.audio = localAudio;

                result.setObject(lightsaberMesh);

                return result;
              });
              entityApi.soundBodies = soundBodies;

              entityApi.color = new THREE.Color(0x000000);
              entityApi.render = () => {
                const {color} = entityApi;
                const {bladeMesh} = lightsaberMesh;

                bladeMesh.material.color.copy(color);
              };

              const _makeLightsaberState = () => ({
                grabbed: false,
                ignited: false,
              });
              const lightsaberStates = {
                left: _makeLightsaberState(),
                right: _makeLightsaberState(),
              };

              const _grab = e => {
                const {detail: {side}} = e;
                const lightsaberState = lightsaberStates[side];

                lightsaberState.grabbed = true;
              };
              entityElement.addEventListener('grab', _grab);
              const _release = e => {
                const {detail: {side}} = e;
                const lightsaberState = lightsaberStates[side];

                lightsaberState.grabbed = false;

                const {ignited} = lightsaberState;
                if (ignited) {
                  lightsaberState.ignited = false;

                  const {bladeMesh} = lightsaberMesh;
                  bladeMesh.visible = false;

                  if (!soundBodies[0].audio.paused) {
                    soundBodies[0].audio.pause();
                  }
                  if (!soundBodies[1].audio.paused) {
                    soundBodies[1].audio.pause();
                  }
                  if (soundBodies[2].audio.paused) {
                    soundBodies[2].audio.currentTime = 0;
                    soundBodies[2].audio.play();
                  }
                }
              };
              entityElement.addEventListener('release', _release);
              const _trigger = e => {
                const {side} = e;
                const lightsaberState = lightsaberStates[side];
                const {grabbed} = lightsaberState;

                if (grabbed) {
                  e.stopImmediatePropagation();
                }
              };
              input.on('trigger', _trigger, {
                priority: 1,
              });
              const _triggerdown = e => {
                const {side} = e;
                const lightsaberState = lightsaberStates[side];
                const {grabbed} = lightsaberState;

                if (grabbed) {
                  const {ignited} = lightsaberState;

                  if (!ignited) {
                    lightsaberState.ignited = true;

                    const {bladeMesh} = lightsaberMesh;
                    bladeMesh.visible = true;

                    if (soundBodies[0].audio.paused) {
                      soundBodies[0].audio.currentTime = 0;
                      soundBodies[0].audio.play();
                    }
                    if (soundBodies[1].audio.paused) {
                      soundBodies[1].audio.play();
                    }
                  }

                  e.stopImmediatePropagation();
                }
              };
              input.on('triggerdown', _triggerdown, {
                priority: 1,
              });
              const _triggerup = e => {
                const {side} = e;
                const lightsaberState = lightsaberStates[side];
                const {grabbed} = lightsaberState;

                if (grabbed) {
                  const {ignited} = lightsaberState;

                  if (ignited) {
                    lightsaberState.ignited = false;

                    const {bladeMesh} = lightsaberMesh;
                    bladeMesh.visible = false;

                    if (!soundBodies[0].audio.paused) {
                      soundBodies[0].audio.pause();
                    }
                    if (!soundBodies[1].audio.paused) {
                      soundBodies[1].audio.pause();
                    }
                    if (soundBodies[2].audio.paused) {
                      soundBodies[2].audio.currentTime = 0;
                      soundBodies[2].audio.play();
                    }
                  }

                  e.stopImmediatePropagation();
                }
              };
              input.on('triggerup', _triggerup, {
                priority: 1,
              });

              const bullets = [];
              let lastBulletTime = Date.now();

              const _update = () => {
                const _updateDrone = () => {
                  const {hmd: hmdStatus} = pose.getStatus();
                  const {position: hmdPosition} = hmdStatus;

                  droneMesh.lookAt(hmdPosition);
                };
                const _addBullets = () => {
                  const now = Date.now();
                  const timeDiff = now - lastBulletTime;

                  if (timeDiff >= BULLET_RATE) {
                    const {pupilMesh} = droneMesh;
                    const {position, rotation, scale} = _decomposeObjectMatrixWorld(pupilMesh);

                    const bullet = _makeBulletMesh();
                    bullet.position.copy(position);
                    bullet.quaternion.copy(rotation);
                    bullet.scale.copy(scale);
                    scene.add(bullet);
                    bullets.push(bullet);

                    lastBulletTime = now;
                  }
                };
                const _updateBullets = () => {
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

                _updateDrone();
                _addBullets();
                _updateBullets();
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(lightsaberMesh);
                scene.remove(droneMesh);

                for (let i = 0; i < bullets.length; i++) {
                  const bullet = bullets[i];
                  scene.remove(bullet);
                }

                entityElement.removeEventListener('grab', _grab);
                entityElement.removeEventListener('release', _release);

                input.removeListener('trigger', _trigger);
                input.removeListener('triggerdown', _triggerdown);
                input.removeListener('triggerup', _triggerup);

                render.removeListener('update', _update);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              switch (name) {
                case 'position': {
                  const position = newValue;

                  if (position) {
                    entityObject.position.set(position[0], position[1], position[2]);
                    entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                    entityObject.scale.set(position[7], position[8], position[9]);
                  }

                  break;
                }
                case 'color': {
                  entityApi.color = new THREE.Color(newValue);

                  entityApi.render();

                  break;
                }
              }
            },
          };
          elements.registerComponent(this, fighterComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, fighterComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = ZFighter;
