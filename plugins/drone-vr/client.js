const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');

const BULLET_RATE = 200;
const BULLET_SPEED = 0.002;
const BULLET_TTL = 10 * 1000;
const DRONE_DISTANCE = 3;

const SIDES = ['left', 'right'];
const dataSymbol = Symbol();

class DroneVr {
  mount() {
    const {three: {THREE, scene, camera}, items, input, pose, hands, render, sound, utils: {geometry: geometryUtils}} = zeo;

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

    const droneItem = {
      path: 'drone-vr/drone',
      itemAddedCallback(itemElement) {
        const _trigger = e => {
          const {side} = e;
          const grabbedGrabbable = hands.getGrabbedGrabbable(side);

          if (grabbedGrabbable === itemElement) {
            const liveState = {
              live: true,
            };

            const droneMesh = (() => {
              const object = new THREE.Object3D();
              // object.position.y = 2;
              object.position.copy(itemElement.position);

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

            const _isLive = () => liveState.live;

            const bullets = [];
            let now = Date.now();
            let lastUpdateTime = now;
            let lastBulletUpdateTime = now;

            const _update = () => {
              now = Date.now();

              const _updateDrone = () => {
                const _updateDroneMove = () => {
                  if (now >= droneState.endTime) {
                    const {hmd: hmdStatus} = pose.getStatus();
                    const {worldPosition: hmdPosition} = hmdStatus;

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
                  const {worldPosition: hmdPosition} = hmdStatus;

                  droneMesh.lookAt(hmdPosition);
                };
                const _updateDroneMatrix = () => {
                  droneMesh.updateMatrixWorld();
                };

                _updateDroneMove();
                _updateDroneLook();
                _updateDroneMatrix();
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

                  bullet.updateMatrixWorld();

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
                    bullet.updateMatrixWorld();

                    bullet.lastTime = now;
                  } else {
                    scene.remove(bullet);
                    bullets.splice(bullets.indexOf(bullet), 1);
                  }
                }
              };

              const _resetDrone = () => {
                droneMesh.position.set(0, 1.5, 0);
                droneMesh.quaternion.copy(zeroQuaternion);
                droneMesh.updateMatrixWorld();
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
                _updateDrone();
                _addBullets();
                // _intersectBullets();
                _updateBullets();
              } else {
                _resetDrone();
                _resetBullets();
              }

              lastUpdateTime = now;
            };
            render.on('update', _update);

            const _cleanup = () => {
              scene.remove(droneMesh);

              for (let i = 0; i < bullets.length; i++) {
                const bullet = bullets[i];
                scene.remove(bullet);
              }

              render.removeListener('update', _update);
            };

            items.destroyItem(itemElement);
          }
        };
        input.on('trigger', _trigger);

        itemElement[dataSymbol] = {
          color: new THREE.Color(0x000000),
          recolor: () => {
            console.log('set color', itemElement[dataSymbol].color);
          },
          _cleanup: () => {
            input.removeListener('trigger', _trigger);
          },
        };
      },
      itemRemovedCallback(itemElement) {
        itemElement[dataSymbol]._cleanup();
      },
      itemAttributeValueChangedCallback(itemElement, name, oldValue, newValue) {
        switch (name) {
          case 'color': {
            itemElement[dataSymbol].color = new THREE.Color(newValue);
            itemElement[dataSymbol].recolor();

            break;
          }
        }
      },
    };
    items.registerItem(this, droneItem);

    this._cleanup = () => {
      whiteMaterial.dispose();
      bulletGeometry.dispose();
      bulletMaterial.dispose();

      items.unregisterItem(this, droneItem);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = DroneVr;
