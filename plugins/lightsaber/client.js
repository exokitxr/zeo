const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');

const SIDES = ['left', 'right'];

class Lightsaber {
  mount() {
    const {three: {THREE, scene, camera}, elements, input, pose, render, sound, ui, payment, utils: {geometry: geometryUtils}} = zeo;

    let live = true;
    this.cleanup = () => {
      live = false;
    };

    const zeroVector = new THREE.Vector3();
    const forwardVector = new THREE.Vector3(0, 0, -1);
    const zeroQuaternion = new THREE.Quaternion();

    const _requestAudio = src => new Promise((accept, reject) => {
      const audio = document.createElement('audio');

      const _cleanup = () => {
        audio.oncanplay = null;
        audio.onerror = null;

        document.body.removeChild(audio);
      };

      audio.oncanplaythrough = () => {
        _cleanup();

        accept(audio);
      };
      audio.onerror = () => {
        _cleanup();

        reject(audio);
      };
      audio.crossOrigin = 'Anonymous';
      audio.src = src;

      audio.style.cssText = 'position: absolute; visibility: hidden';
      document.body.appendChild(audio);
    });

    return Promise.all([
      _requestAudio('archae/z-lightsaber/audio/kylo1.ogg'),
      _requestAudio('archae/z-lightsaber/audio/kylo2.ogg')
        .then(audio => {
          audio.loop = true;
          return audio;
        }),
      _requestAudio('archae/z-lightsaber/audio/kylo3.ogg'),
    ])
      .then(([
        kylo1Audio,
        kylo2Audio,
        kylo3Audio,
      ]) => {
        if (live) {
          const whiteMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
          });

          const lightsaberEntity = {
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 1.2, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              type: {
                type: 'select',
                value: 'crossguard',
                options: [
                  'crossguard',
                  'dual',
                ],
              },
              color: {
                type: 'color',
                value: '#F44336',
              },
              grabbable: {
                type: 'checkbox',
                value: true,
              },
              holdable: {
                type: 'checkbox',
                value: true,
              },
              live: {
                type: 'checkbox',
                value: true,
              },
              size: {
                type: 'vector',
                value: [0.2, 0.2, 0.2],
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getEntityApi();
              const entityObject = entityElement.getObject();

              const liveState = {
                live: false,
                health: 0,
                paused: true,
              };

              const bladeMaterial = new THREE.MeshBasicMaterial({
                color: 0xF44336,
                shading: THREE.FlatShading,
              });

              const _makeCrossguardLightsaberMesh = () => {
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
                  const object = new THREE.Object3D();
                  object.visible = false;

                  const coreMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(0.02 * 0.9, 0.02 * 0.9, 1)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.1 / 2) - 0.02 - (1 / 2)));
                    const material = bladeMaterial;

                    return new THREE.Mesh(geometry, material);
                  })();
                  object.add(coreMesh);
                  object.coreMesh = coreMesh;

                  const leftMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(0.1, 0.02 * 0.9, 0.02 * 0.9)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(-(0.1 / 2) - (0.1 / 2), 0, -(0.1 / 2) - (0.02 / 2)));
                    const material = bladeMaterial;

                    return new THREE.Mesh(geometry, material);
                  })();
                  object.add(leftMesh);
                  object.leftMesh = leftMesh;

                  const rightMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(0.1, 0.02 * 0.9, 0.02 * 0.9)
                      .applyMatrix(new THREE.Matrix4().makeTranslation((0.1 / 2) + (0.1 / 2), 0, -(0.1 / 2) - (0.02 / 2)));
                    const material = bladeMaterial;

                    return new THREE.Mesh(geometry, material);
                  })();
                  object.add(rightMesh);
                  object.rightMesh = rightMesh;

                  return object;
                })();
                object.add(bladeMesh);
                object.bladeMesh = bladeMesh;

                const hitMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 1);
                  const material = whiteMaterial;

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.set(0, 0, -(0.1 / 2) - 0.02 - (1 / 2));
                  mesh.visible = false;
                  return mesh;
                })();
                object.add(hitMesh);
                object.hitMesh = hitMesh;

                object.setValue = value => {
                  const {coreMesh, leftMesh, rightMesh} = bladeMesh;

                  coreMesh.scale.set(1, 1, value);
                  leftMesh.scale.set(value, 1, 1);
                  rightMesh.scale.set(value, 1, 1);
                  hitMesh.scale.set(1, 1, value);

                  coreMesh.updateMatrixWorld();
                  leftMesh.updateMatrixWorld();
                  rightMesh.updateMatrixWorld();
                  hitMesh.updateMatrixWorld();
                };

                object.destroy = () => {
                  // XXX
                };

                return object;
              };
              const _makeDualLightsaberMesh = () => {
                const object = new THREE.Object3D();

                const handleMesh = (() => {
                  const geometry = (() => {
                    const sq = n => Math.sqrt((n * n) + (n * n));

                    const handleGeometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.2);
                    const topGeometry = new THREE.BoxBufferGeometry(0.04, 0.04, 0.02)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.2 / 2) - (0.02 / 2)));
                    const bottomGeometry = new THREE.BoxBufferGeometry(0.04, 0.04, 0.02)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, (0.2 / 2) + (0.02 / 2)));

                    return geometryUtils.concatBufferGeometry([handleGeometry, topGeometry, bottomGeometry]);
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
                  const object = new THREE.Object3D();
                  object.visible = false;

                  const topMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(0.02 * 0.9, 0.02 * 0.9, 1)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(0.2 / 2) - 0.02 - (1 / 2)));
                    const material = bladeMaterial;

                    return new THREE.Mesh(geometry, material);
                  })();
                  object.add(topMesh);
                  object.topMesh = topMesh;

                  const bottomMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(0.02 * 0.9, 0.02 * 0.9, 1)
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, (0.2 / 2) + 0.02 + (1 / 2)));
                    const material = bladeMaterial;

                    return new THREE.Mesh(geometry, material);
                  })();
                  object.add(bottomMesh);
                  object.bottomMesh = bottomMesh;

                  return object;
                })();
                object.add(bladeMesh);
                object.bladeMesh = bladeMesh;

                const hitMesh = (() => {
                  const object = new THREE.Object3D();
                  object.visible = false;

                  const topHitMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 1);
                    const material = whiteMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(0, 0, -(0.2 / 2) - 0.02 - (1 / 2));
                    return mesh;
                  })();
                  object.add(topHitMesh);
                  object.topHitMesh = topHitMesh;

                  const bottomHitMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 1);
                    const material = whiteMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(0, 0, (0.2 / 2) + 0.02 + (1 / 2));
                    return mesh;
                  })();
                  object.add(bottomHitMesh);
                  object.bottomHitMesh = bottomHitMesh;

                  return object;
                })();
                object.add(hitMesh);
                object.hitMesh = hitMesh;

                object.setValue = value => {
                  const {topMesh, bottomMesh} = bladeMesh;

                  topMesh.scale.set(1, 1, value);
                  bottomMesh.scale.set(1, 1, value);
                  hitMesh.scale.set(1, 1, value);

                  topMesh.updateMatrixWorld();
                  bottomMesh.updateMatrixWorld();
                  hitMesh.updateMatrixWorld();
                };

                object.destroy = () => {
                  // XXX
                };

                return object;
              };

              const lightsaberMesh = (() => {
                const object = new THREE.Object3D();
                object.mesh = null;
                return object;
              })();
              entityObject.add(lightsaberMesh);

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

              const _isEnabled = () => liveState.health !== 0;
              const _isLive = () => liveState.live;
              const _isPaused = () => liveState.paused;

              entityApi.bladeType = 'crossguard';
              entityApi.remesh = () => {
                const {mesh: oldMesh} = lightsaberMesh;
                if (oldMesh) {
                  lightsaberMesh.remove(oldMesh);
                  oldMesh.destroy();

                  lightsaberMesh.mesh = null;
                }

                const {bladeType} = entityApi;
                if (bladeType === 'crossguard') {
                  const mesh = _makeCrossguardLightsaberMesh();
                  lightsaberMesh.add(mesh);
                  lightsaberMesh.mesh = mesh;
                } else if (bladeType === 'dual') {
                  const mesh = _makeDualLightsaberMesh();
                  lightsaberMesh.add(mesh);
                  lightsaberMesh.mesh = mesh;
                }
              };

              entityApi.color = new THREE.Color(0x000000);
              entityApi.recolor = () => {
                const {color} = entityApi;

                bladeMaterial.color.copy(color);
              };

              const _makeLightsaberState = () => ({
                grabbed: false,
                ignited: false,
                value: 0,
              });
              const lightsaberStates = {
                left: _makeLightsaberState(),
                right: _makeLightsaberState(),
              };

              const _grab = e => {
                const {detail: {side}} = e;
                const lightsaberState = lightsaberStates[side];

                lightsaberState.grabbed = true;

                liveState.paused = false;
              };
              entityElement.addEventListener('grab', _grab);
              const _release = e => {
                const {detail: {side}} = e;
                const lightsaberState = lightsaberStates[side];

                lightsaberState.grabbed = false;

                const {ignited} = lightsaberState;
                if (ignited) {
                  lightsaberState.ignited = false;

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

                liveState.paused = true;
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

                if (grabbed && _isLive()) {
                  const {ignited} = lightsaberState;

                  if (!ignited) {
                    lightsaberState.ignited = true;

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
              const _menudown = e => {
                const {side} = e;
                const lightsaberState = lightsaberStates[side];
                const {grabbed} = lightsaberState;

                if (grabbed) {
                  if (!_isLive()) {
                    payment.requestCharge({
                      dstAddress: 'n3W1ExUh7Somt28Qe7DT5FUfY127MY4r1X',
                      srcAsset: 'CRAPCOIN',
                      srcQuantity: 1,
                    })
                      .then(() => {
                        liveState.live = true;
                        liveState.health = 100;

                        const {page} = hudMesh;
                        page.update();
                      })
                      .catch(err => {
                        console.warn(err);
                      });
                  } else {
                    liveState.live = false;
                    liveState.health = 0;

                    const {page} = hudMesh;
                    page.update();
                  }

                  e.stopImmediatePropagation();
                }
              };
              input.on('menudown', _menudown, {
                priority: 2,
              });

              const bullets = [];
              let now = Date.now();
              let lastUpdateTime = now;
              let lastBulletUpdateTime = now;

              const _update = () => {
                now = Date.now();

                const _updateLightsaber = () => {
                  SIDES.forEach(side => {
                    const lightsaberState = lightsaberStates[side]
                    const {ignited} = lightsaberState;

                    if (ignited) {
                      lightsaberState.value = Math.min(lightsaberState.value + ((now - lastUpdateTime) / 1000 * 25), 1);
                    } else {
                      lightsaberState.value = Math.max(lightsaberState.value - ((now - lastUpdateTime) / 1000 * 2), 0);
                    }
                  });

                  const value = Math.max(lightsaberStates.left.value, lightsaberStates.right.value);
                  const {mesh: lightsaberMeshMesh} = lightsaberMesh;
                  if (lightsaberMeshMesh) {
                    const {bladeMesh} = lightsaberMeshMesh;

                    if (value < 0.001) {
                      if (bladeMesh.visible) {
                        bladeMesh.visible = false;
                      }
                    } else {
                      lightsaberMeshMesh.setValue(value);

                      if (!bladeMesh.visible) {
                        bladeMesh.visible = true;
                      }
                    }
                  }
                };

                const _resetLightsaber = () => {
                  const {mesh: lightsaberMeshMesh} = lightsaberMesh;

                  if (lightsaberMeshMesh) {
                    const {bladeMesh} = lightsaberMeshMesh;

                    if (bladeMesh.visible) {
                      bladeMesh.visible = false;
                    }
                  };
                };
                const _resetBullets = () => {
                  if (bullets.length > 0) {
                    for (let i = 0; i < bullets.length; i++) {
                      const bullet = bullets[i];
                      scene.remove(bullet);
                    }
                    bullets.length = 0;
                  }
                };

                if (_isLive()) {
                  _updateLightsaber();
                } else {
                  _resetLightsaber();
                }

                lastUpdateTime = now;
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(lightsaberMesh);
                scene.remove(droneMesh);
                for (let i = 0; i < bullets.length; i++) {
                  const bullet = bullets[i];
                  scene.remove(bullet);
                }

                scene.remove(hudMesh);
                hudMesh.destroy();
                const {page} = hudMesh;
                ui.removePage(page);

                bladeMaterial.dispose();

                entityElement.removeEventListener('grab', _grab);
                entityElement.removeEventListener('release', _release);

                input.removeListener('trigger', _trigger);
                input.removeListener('triggerdown', _triggerdown);
                input.removeListener('triggerup', _triggerup);
                input.removeListener('menudown', _menudown);

                render.removeListener('update', _update);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getEntityApi();

              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityApi = entityElement.getEntityApi();
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
                case 'type': {
                  entityApi.bladeType = newValue;

                  entityApi.remesh();

                  break;
                }
                case 'color': {
                  entityApi.color = new THREE.Color(newValue);

                  entityApi.recolor();

                  break;
                }
                case 'live': {
                  // XXX handle this

                  break;
                }
              }
            },
          };
          elements.registerEntity(this, lightsaberEntity);

          this._cleanup = () => {
            whiteMaterial.dispose();

            elements.unregisterEntity(this, lightsaberEntity);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = Lightsaber;
