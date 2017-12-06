const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');

const SIDES = ['left', 'right'];
const dataSymbol = Symbol();

class Lightsaber {
  mount() {
    const {three: {THREE, scene, camera}, items, input, pose, render, sound, utils: {geometry: geometryUtils}} = zeo;

    let live = true;
    this.cleanup = () => {
      live = false;
    };

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
      _requestAudio('archae/lightsaber/audio/kylo1.ogg'),
      _requestAudio('archae/lightsaber/audio/kylo2.ogg')
        .then(audio => {
          audio.loop = true;
          return audio;
        }),
      _requestAudio('archae/lightsaber/audio/kylo3.ogg'),
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

          const lightsaberItem = {
            path: 'lightsaber/lightsaber',
            itemAddedCallback(itemElement) {
              const {mesh: object} = itemElement;

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
              object.add(lightsaberMesh);

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
                const {side} = e;
                const lightsaberState = lightsaberStates[side];

                lightsaberState.grabbed = true;
              };
              itemElement.on('grab', _grab);
              const _release = e => {
                const {side} = e;
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
              };
              itemElement.on('release', _release);
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

                // if (_isLive()) {
                  _updateLightsaber();
                /* } else {
                  _resetLightsaber();
                } */

                lastUpdateTime = now;
              };
              render.on('update', _update);

              itemElement[dataSymbol] = {
                bladeType: 'crossguard',
                remesh: () => {
                  const {mesh: oldMesh} = lightsaberMesh;
                  if (oldMesh) {
                    lightsaberMesh.remove(oldMesh);
                    oldMesh.destroy();

                    lightsaberMesh.mesh = null;
                  }

                  const {bladeType} = itemElement[dataSymbol];
                  if (bladeType === 'crossguard') {
                    const mesh = _makeCrossguardLightsaberMesh();
                    lightsaberMesh.add(mesh);
                    lightsaberMesh.mesh = mesh;
                  } else if (bladeType === 'dual') {
                    const mesh = _makeDualLightsaberMesh();
                    lightsaberMesh.add(mesh);
                    lightsaberMesh.mesh = mesh;
                  }
                },
                color: new THREE.Color(0x000000),
                recolor: () => {
                  bladeMaterial.color.copy(itemElement[dataSymbol].color);
                },
                _cleanup: () => {
                  bladeMaterial.dispose();

                  itemElement.removeListener('grab', _grab);
                  itemElement.removeListener('release', _release);

                  input.removeListener('trigger', _trigger);
                  input.removeListener('triggerdown', _triggerdown);
                  input.removeListener('triggerup', _triggerup);

                  render.removeListener('update', _update);
                },
              };
            },
            itemRemovedCallback(itemElement) {
              itemElement[dataSymbol]._cleanup();
            },
            itemAttributeValueChangedCallback(itemElement, name, oldValue, newValue) {
              switch (name) {
                case 'type': {
                  itemElement[dataSymbol].bladeType = newValue;
                  itemElement[dataSymbol].remesh();

                  break;
                }
                case 'color': {
                  itemElement[dataSymbol].color = new THREE.Color(newValue);
                  itemElement[dataSymbol].recolor();

                  break;
                }
              }
            },
          };
          items.registerItem(this, lightsaberItem);

          this._cleanup = () => {
            whiteMaterial.dispose();

            items.unregisterItem(this, lightsaberItem);
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
