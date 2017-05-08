const BULLET_RATE = 200;
const BULLET_SPEED = 0.002;
const BULLET_TTL = 10 * 1000;
const DRONE_DISTANCE = 3;
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

    const zeroVector = new THREE.Vector3();
    const forwardVector = new THREE.Vector3(0, 0, -1);

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
          const bulletMaterial = new THREE.MeshBasicMaterial({
            color: 0x2196F3,
            shading: THREE.FlatShading,
          });
          const _makeBulletMesh = () => {
            const geometry = bulletGeometry;
            const material = bulletMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.startTime = Date.now();
            mesh.lastTime = mesh.lastTime;
            mesh.intersected = false;
            return mesh;
          };

          const fighterComponent = {
            selector: 'fighter[position][type]',
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
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

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
                  /* const material = new THREE.MeshPhongMaterial({
                    color: 0x666666,
                    shading: THREE.FlatShading,
                    transparent: true,
                    opacity: 0.25,
                  }); */
                  const material = new THREE.MeshBasicMaterial({
                    color: 0xFFFFFF,
                    // transparent: true,
                    // opacity: 0,
                  });
                  // material.colorWrite = false;

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
                    color: 0x111111,
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

              const droneState = (() => {
                const dronePosition = droneMesh.getWorldPosition();
                const now = Date.now();
                return {
                  direction: forwardVector.clone(),
                  startPosition: dronePosition,
                  endPosition: dronePosition,
                  startTime: now,
                  endTime: now,
                };
              })();

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

              const bullets = [];
              let lastUpdateTime = Date.now();
              let lastBulletUpdateTime = Date.now();

              const _update = () => {
                const now = Date.now();

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
                const _updateDroneMove = () => {
                  if (now >= droneState.endTime) {
                    const {hmd: hmdStatus} = pose.getStatus();
                    const {position: hmdPosition} = hmdStatus;

                    const _getNearbyDirection = oldDirection => {
                      for (;;) {
                        const randomDirection = new THREE.Vector3(-0.5 + Math.random(), (-0.5 + Math.random()) * 0.2, -0.5 + Math.random()).normalize();

                        if (randomDirection.distanceTo(oldDirection) <= 1.5) {
                          return randomDirection;
                        }
                      }
                    };

                    droneState.direction = _getNearbyDirection(droneState.direction);
                    droneState.startPosition = droneMesh.position.clone();
                    droneState.endPosition = hmdPosition.clone().add(
                      forwardVector.clone()
                        .multiplyScalar(DRONE_DISTANCE)
                        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
                          forwardVector,
                          droneState.direction
                        ))
                    );
                    droneState.startTime = now;
                    droneState.endTime = now + ((0.5 + (Math.random() * 0.5)) * 2000);
                  }

                  const {startPosition, endPosition, startTime, endTime} = droneState;
                  const newPosition = startPosition.clone().add(
                    endPosition.clone().sub(startPosition)
                      .multiplyScalar((now - startTime) / (endTime - startTime))
                  );
                  droneMesh.position.copy(newPosition);
                };
                const _updateDroneLook = () => {
                  const {hmd: hmdStatus} = pose.getStatus();
                  const {position: hmdPosition} = hmdStatus;

                  droneMesh.lookAt(hmdPosition);
                };
                const _addBullets = () => {
                  const timeDiff = now - lastBulletUpdateTime;

                  if (timeDiff >= BULLET_RATE) {
                    const {pupilMesh} = droneMesh;
                    const {position, rotation, scale} = _decomposeObjectMatrixWorld(pupilMesh);

                    const bullet = _makeBulletMesh();
                    bullet.position.copy(position);
                    bullet.quaternion.copy(rotation);
                    bullet.scale.copy(scale);
                    scene.add(bullet);
                    bullets.push(bullet);

                    lastBulletUpdateTime = now;
                  }
                };
                const _intersectBullets = () => {
                  const {mesh: lightsaberMeshMesh} = lightsaberMesh;

                  if (lightsaberMeshMesh) {
                    const {hitMesh} = lightsaberMeshMesh;
                    hitMesh.visible = true;
                    const hitMeshRotation = hitMesh.getWorldQuaternion();
                    const raycaster = new THREE.Raycaster();
                    raycaster.near = 0.01;
                    raycaster.far = 100000;

                    for (let i = 0; i < bullets.length; i++) {
                      const bullet = bullets[i];

                      if (!bullet.intersected) {
                        const {position: bulletPosition, rotation: bulletRotation} = _decomposeObjectMatrixWorld(bullet);
                        const ray = new THREE.Ray(
                          bulletPosition,
                          forwardVector.clone()
                            .multiplyScalar(0.01)
                            .applyQuaternion(bulletRotation)
                        );
                        raycaster.ray = ray;
                        const intersections = raycaster.intersectObject(hitMesh);

                        if (intersections.length > 0) {
                          const intersection = intersections[0];
                          const {face} = intersection;
                          const {normal} = face;
                          const worldNormal = normal.clone().applyQuaternion(hitMeshRotation);
                          const controllerLinearVelocity = (() => {
                            let result = zeroVector;

                            SIDES.some(side => {
                              const lightsaberState = lightsaberStates[side]
                              const {grabbed} = lightsaberState;

                              if (grabbed) {
                                result = pose.getControllerLinearVelocity(side);
                                return true;
                              } else {
                                return false;
                              }
                            });

                            return result;
                          })();
                          const reflectionVector = worldNormal.clone()
                            .add(controllerLinearVelocity.clone().multiplyScalar(2))
                            .normalize();

                          bullet.quaternion.setFromUnitVectors(
                            forwardVector,
                            reflectionVector
                          );
                          bullet.intersected = true;
                        }
                      }
                    }

                    hitMesh.visible = false;
                  }
                }
                const _updateBullets = () => {
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

                _updateLightsaber();
                _updateDroneMove();
                _updateDroneLook();
                _addBullets();
                _intersectBullets();
                _updateBullets();

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

                bladeMaterial.dispose();

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
                case 'type': {
                  entityApi.type = newValue;

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
          elements.registerComponent(this, fighterComponent);

          this._cleanup = () => {
            bulletGeometry.dispose();
            bulletMaterial.dispose();

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
