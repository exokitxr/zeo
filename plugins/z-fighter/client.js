const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');
const menuRenderer = require('./lib/render/menu');

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
    const {three: {THREE, scene, camera}, elements, input, pose, render, sound, ui, payment, utils: {geometry: geometryUtils}} = zeo;

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
          const whiteMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
          });
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

              const droneMesh = (() => {
                const object = new THREE.Object3D();
                object.position.y = 2;

                const coreMesh = (() => {
                  const geometry = new THREE.SphereBufferGeometry(0.1, 8, 6);
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
                  const geometry = new THREE.CylinderBufferGeometry(0.05, 0.05, 0.015, 8, 1)
                    .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                  const material = new THREE.MeshPhongMaterial({
                    color: 0xEEEEEE,
                    shading: THREE.FlatShading,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.z = 0.1 - 0.015;
                  mesh.rotation.y = Math.PI;
                  mesh.rotation.order = camera.rotation.order;
                  return mesh;
                })();
                object.add(eyeballMesh);
                object.eyeballMesh = eyeballMesh;

                const pupilMesh = (() => {
                  const geometry = new THREE.CylinderBufferGeometry(0.03, 0.03, 0.015, 8, 1)
                    .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                  const material = new THREE.MeshPhongMaterial({
                    color: 0x111111,
                    shading: THREE.FlatShading,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.z = 0.1 - 0.005;
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

              const _isEnabled = () => liveState.health !== 0;
              const _isLive = () => liveState.live;
              const _isPaused = () => liveState.paused;

              const hudMesh = (() => {
                const menuUi = ui.makeUi({
                  width: WIDTH,
                  height: HEIGHT,
                  color: [1, 1, 1, 0],
                });
                const mesh = menuUi.makePage(({
                  live: {
                    live,
                    health,
                  },
                }) => ({
                  type: 'html',
                  src: menuRenderer.getHudSrc({live, health}),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: HEIGHT,
                }), {
                  type: 'fighter',
                  state: {
                    live: liveState,
                  },
                  worldWidth: WORLD_WIDTH,
                  worldHeight: WORLD_HEIGHT,
                });
                // mesh.rotation.order = camera.rotation.order;
                mesh.visible = _isEnabled();

                const _align = (position, rotation, scale, lerpFactor) => {
                  const targetPosition = position.clone().add(
                    new THREE.Vector3(
                      0,
                      (((WIDTH - HEIGHT) / 2) / HEIGHT * WORLD_HEIGHT) + WORLD_HEIGHT,
                      -0.5
                    ).applyQuaternion(rotation)
                  );
                  const targetRotation = rotation;
                  const distance = position.distanceTo(targetPosition);

                  if (lerpFactor < 1) {
                    mesh.position.add(
                      targetPosition.clone().sub(mesh.position).multiplyScalar(distance * lerpFactor)
                    );
                    mesh.quaternion.slerp(targetRotation, lerpFactor);
                    mesh.scale.copy(scale);
                  } else {
                    mesh.position.copy(targetPosition);
                    mesh.quaternion.copy(targetRotation);
                    mesh.scale.copy(scale);
                  }
                };
                mesh.align = _align;

                const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
                mesh.align(cameraPosition, cameraRotation, cameraScale, 1);

                const {page} = mesh;
                ui.addPage(page);
                page.update();

                return mesh;
              })();
              scene.add(hudMesh);
              entityApi.hudMesh = hudMesh;

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

                if (!liveState.live) {
                  payment.requestBuy({
                    asset: 'CRAPCOIN',
                    quantity: 1,
                    address: 'xxxxxxxxxxxxxxxxxxxx',
                  })
                    .then(() => {
                      liveState.live = true; // XXX trigger this via payment
                      liveState.health = 100;

                      const {page} = hudMesh;
                      page.update();
                    })
                    .catch(err => {
                      console.warn(err);
                    });
                }

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
              let now = Date.now();
              let lastUpdateTime = now;
              let lastBulletUpdateTime = now;

              const _update = () => {
                now = Date.now();

                const _updateHudMesh = () => {
                  const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
                  const timeDiff = now - lastUpdateTime;
                  const lerpFactor = timeDiff * 0.005;
                  hudMesh.align(cameraPosition, cameraRotation, cameraScale, lerpFactor);

                  if (!hudMesh.visible) {
                    hudMesh.visible = true;
                  }
                };
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
                    const {bladeMesh} = lightsaberMeshMesh;

                    if (bladeMesh.visible) {
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
                            bulletPosition.add(
                              forwardVector.clone()
                                .multiplyScalar(-0.05)
                                .applyQuaternion(bulletRotation)
                            ),
                            forwardVector.clone()
                              .multiplyScalar(0.1)
                              .applyQuaternion(bulletRotation)
                          );
                          raycaster.ray = ray;
                          const intersections = raycaster.intersectObject(hitMesh, true);

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

                const _resetHudMesh = () => {
                  const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
                  hudMesh.align(cameraPosition, cameraRotation, cameraScale, 1);

                  if (hudMesh.visible) {
                    hudMesh.visible = false;
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
                const _resetDrone = () => {
                  droneMesh.position.set(0, 1.5, 0);
                  droneMesh.quaternion.copy(zeroQuaternion);
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

                  if (!_isPaused()) {
                    _updateHudMesh();
                    _updateDroneMove();
                    _updateDroneLook();
                    _addBullets();
                    _intersectBullets();
                    _updateBullets();
                  } else {
                    _resetHudMesh();
                  }
                } else {
                  _resetHudMesh();
                  _resetLightsaber();
                  _resetDrone();
                  _resetBullets();
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
          elements.registerComponent(this, fighterComponent);

          this._cleanup = () => {
            whiteMaterial.dispose();
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
