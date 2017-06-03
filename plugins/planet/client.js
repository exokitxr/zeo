const GPUPickerLib = require('./lib/three-extra/GPUPicker.js');

const SIZE = 16;

const SIDES = ['left', 'right'];

class Planet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three: {THREE, scene, camera, renderer}, pose, input, render, sound, teleport, utils: {geometry: geometryUtils}} = zeo;

    const GPUPicker = GPUPickerLib(THREE);

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    const forwardVector = new THREE.Vector3(0, 0, -1);
    const upVector = new THREE.Vector3(0, 1, 0);
    const oneDistance = Math.sqrt(3);

    const planetMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      side: THREE.DoubleSide, // XXX
    });
    const waterMaterial = new THREE.MeshPhongMaterial({
      color: 0x44447A,
      shading: THREE.FlatShading,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide, // XXX
    });
    const glassMaterial = new THREE.MeshPhongMaterial({
      color: 0xFFFFFF,
      shading: THREE.FlatShading,
      transparent: true,
      opacity: 0.3,
    });
    const normalMaterial = new THREE.MeshPhongMaterial({
      color: 0xF44336,
      shading: THREE.FlatShading,
      transparent: true,
      opacity: 0.5,
    });

    const seed = (() => {
      const seedArray = new Uint32Array(1);
      window.crypto.getRandomValues(seedArray);
      return seedArray[0];
    })();
    let holes = new Int32Array(4096);
    let holeIndex = 0;
    const _addHole = (x, y, z) => {
      if ((holeIndex * 3) >= holes.length) {
        const oldHoles = holes;
        holes = new Int32Array(holes.length * 2);
        holes.set(oldHoles);
      }

      const holeIndexBase = holeIndex * 3;
      holes[holeIndexBase + 0] = x + (SIZE / 2);
      holes[holeIndexBase + 1] = y + (SIZE / 2);
      holes[holeIndexBase + 2] = z + (SIZE / 2);
      holeIndex++;
    };

    const _makeDotMesh = () => {
      const geometry = geometryUtils.concatBufferGeometry([
        new THREE.BoxBufferGeometry(0.02, 0.02, 0.02),
        new THREE.TorusBufferGeometry(0.05, 0.01, 3, 6)
         .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2)),
      ])
      const material = normalMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      return mesh;
    };
    const dotMeshes = {
      left: _makeDotMesh(),
      right: _makeDotMesh(),
    };
    scene.add(dotMeshes.left);
    scene.add(dotMeshes.right);

    const _makeHoverState = () => ({
      planetMesh: null,
      intersectionObject: null,
      intersectionIndex: null,
      targetPosition: null,
    });
    const hoverStates = {
      left: _makeHoverState(),
      right: _makeHoverState(),
    };

    const particleMeshes = [];
    const itemMeshes = [];

    cleanups.push(() => {
      planetMaterial.dispose();
      glassMaterial.dispose();
      waterMaterial.dispose();
      normalMaterial.dispose();

      SIDES.forEach(side => {
        scene.remove(dotMeshes[side]);
      });
    });

    const _requestMarchingCubes = ({seed = 0, origin = new THREE.Vector3(0, 0, 0), holes = new Int32Array(0)} = {}) => {
      const body = new Int32Array(5 + holes.length);
      new Uint32Array(body.buffer, 0, 1).set(Uint32Array.from([seed]), 0);
      new Uint32Array(body.buffer, 4, 3)
        .set(Uint32Array.from(origin.toArray()), 0);
      body.set(Int32Array.from([holes.length / 3]), 4);
      body.set(holes, 5);

      return fetch('/archae/planet/marchingcubes', {
        method: 'POST',
        body: body.buffer,
      })
        .then(res => res.arrayBuffer())
        .then(marchingCubesBuffer => {
          let index = 0;
          const numLandPositions = new Uint32Array(marchingCubesBuffer, index, 1)[0];
          index += 4;
          const numLandNormals = new Uint32Array(marchingCubesBuffer, index, 1)[0];
          index += 4;
          const numLandColors = new Uint32Array(marchingCubesBuffer, index, 1)[0];
          index += 4;
          const numWaterPositions = new Uint32Array(marchingCubesBuffer, index, 1)[0];
          index += 4;
          const numWaterNormals = new Uint32Array(marchingCubesBuffer, index, 1)[0];
          index += 4;
          const landPositions = new Float32Array(marchingCubesBuffer, index, numLandPositions);
          index += numLandPositions * 4;
          const landNormals = new Float32Array(marchingCubesBuffer, index, numLandNormals);
          index += numLandNormals * 4;
          const landColors = new Float32Array(marchingCubesBuffer, index, numLandColors);
          index += numLandColors * 4;
          const waterPositions = new Float32Array(marchingCubesBuffer, index, numWaterPositions);
          index += numWaterPositions * 4;
          const waterNormals = new Float32Array(marchingCubesBuffer, index, numWaterNormals);
          index += numWaterNormals * 4;

          return {
            origin,
            land: {
              positions: landPositions,
              normals: landNormals,
              colors: landColors,
            },
            water: {
              positions: waterPositions,
              normals: waterNormals,
            },
          };
        });
    }
    const _requestAudio = src => new Promise((accept, reject) => {
      const audio = document.createElement('audio');

      const _cleanup = () => {
        audio.oncanplay = null;
        audio.onerror = null;

        document.body.removeChild(audio);
      };

      audio.oncanplay = () => {
        _cleanup();

        accept(audio);
      };
      audio.onerror = err => {
        _cleanup();

        reject(err);
      };

      audio.src = src;

      document.body.appendChild(audio);
    });

    const chunksRange = 2;
    const chunks = (() => {
      const result = [];

      for (let i = -chunksRange; i <= chunksRange; i++) {
        for (let j = -chunksRange; j <= chunksRange; j++) {
          for (let k = -chunksRange; k <= chunksRange; k++) {
            result.push(new THREE.Vector3(i, j, k));
          }
        }
      }

      return result;
    })();
    const holeRange = 3;

    return Promise.all([
      _requestAudio('archae/planet/audio/pop.mp3'),
      Promise.all(chunks.map(origin => _requestMarchingCubes({seed, origin}))),
    ])
      .then(([
        popAudio,
        marchingCubes,
      ]) => {
        if (live) {
          const _makePlanetMesh = () => {
            const object = new THREE.Object3D();
            object.isPlanetMesh = true;
            object.origin = null;

            const landMesh = (() => {
              const geometry = new THREE.BufferGeometry();
              const material = planetMaterial;
              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(landMesh);
            object.landMesh = landMesh;

            const waterMesh = (() => {
              const geometry = new THREE.BufferGeometry();
              const material = waterMaterial;
              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(waterMesh);
            object.waterMesh = waterMesh;

            object.render = marchingCube => {
              const _renderLand = marchingCube => {
                const {land} = marchingCube;
                const {positions, normals, colors} = land;
                const {geometry} = landMesh;

                geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
                geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
                // geometry.computeBoundingBox();

                if (geometry.__pickingGeometry) {
                  geometry.__pickingGeometry = null;

                  gpuPicker.reindexScene(planetsMesh);
                }
              };
              const _renderWater = marchingCube => {
                const {water} = marchingCube;
                const {positions, normals} = water;
                const {geometry} = waterMesh;

                geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));

                if (geometry.__pickingGeometry) {
                  geometry.__pickingGeometry = null;

                  gpuPicker.reindexScene(planetsMesh);
                }
              };

              _renderLand(marchingCube);
              _renderWater(marchingCube);
            };

            return object;
          };
          const planetsMesh = (() => {
            const object = new THREE.Object3D();

            const planetMeshes = marchingCubes.map(marchingCube => {
              const {origin} = marchingCube;

              const planetMesh = _makePlanetMesh();
              planetMesh.origin = origin;
              planetMesh.render(marchingCube);

              planetMesh.position.copy(origin.clone().multiplyScalar(SIZE));

              return planetMesh;
            });
            planetMeshes.forEach(planetMesh => {
              object.add(planetMesh);
              // teleport.addTarget(planetMesh);
            });

            return object;
          })();
          scene.add(planetsMesh);

          const gpuPicker = new GPUPicker();
          const renderer = new THREE.WebGLRenderer();
          renderer.setSize(256, 256);
          gpuPicker.setRenderer(renderer);
          const gpuPickerCamera = new THREE.PerspectiveCamera();
          scene.add(gpuPickerCamera);
          gpuPicker.setCamera(gpuPickerCamera);
          gpuPicker.setScene(planetsMesh);

          const soundObject = new THREE.Object3D();
          scene.add(soundObject);

          const soundBody = (() => {
            const result = sound.makeBody();

            result.setInputElement(popAudio);
            result.setObject(soundObject);

            return result;
          })();

          const _trigger = e => {
            const {side} = e;
            const hoverState = hoverStates[side];
            const {planetMesh} = hoverState;

            if (planetMesh) {
              const {intersectionObject, intersectionIndex, targetPosition} = hoverState;
              const {geometry: intersectionObjectGeometry} = intersectionObject;
              const {origin} = planetMesh;

              const colorAttribute = intersectionObjectGeometry.getAttribute('color');
              const targetColor = colorAttribute ?
                new THREE.Color().fromArray(colorAttribute.array.slice(intersectionIndex * 3, (intersectionIndex + 1) * 3))
              :
                waterMaterial.color;

              const localPlanetPosition = targetPosition.clone()
                .applyMatrix4(new THREE.Matrix4().getInverse(planetMesh.matrixWorld))
              localPlanetPosition.x = Math.round(localPlanetPosition.x);
              localPlanetPosition.y = Math.round(localPlanetPosition.y);
              localPlanetPosition.z = Math.round(localPlanetPosition.z);
              const absolutePlanetPosition = localPlanetPosition.clone()
                .add(origin.clone().multiplyScalar(SIZE));
              _addHole(
                absolutePlanetPosition.x,
                absolutePlanetPosition.y,
                absolutePlanetPosition.z
              );

              const originsToUpdate = (() => {
                const _getOrigin = p => new THREE.Vector3(
                  Math.floor((p.x + (SIZE / 2)) / SIZE),
                  Math.floor((p.y + (SIZE / 2)) / SIZE),
                  Math.floor((p.z + (SIZE / 2)) / SIZE)
                );

                const result = [];
                [
                  [0, 0, 0],
                  [-1, -1, -1],
                  [-1, -1, 1],
                  [-1, 1, -1],
                  [-1, 1, 1],
                  [1, -1, -1],
                  [1, -1, 1],
                  [1, 1, -1],
                  [1, 1, 1],
                ].forEach(([x, y, z]) => {
                  const checkPosition = absolutePlanetPosition.clone()
                    .add(new THREE.Vector3(x * holeRange, y * holeRange, z * holeRange));
                  const origin = _getOrigin(checkPosition);

                  if (
                    origin.x >= -chunksRange && origin.x <= chunksRange &&
                    origin.y >= -chunksRange && origin.y <= chunksRange &&
                    origin.z >= -chunksRange && origin.z <= chunksRange &&
                    !result.some(o => o.equals(origin))
                  ) {
                    result.push(origin);
                  }
                });
                return result;
              })();

              Promise.all(originsToUpdate.map(origin =>
                _requestMarchingCubes({
                  seed: seed,
                  origin: origin,
                  holes: new Int32Array(holes.buffer, 0, holeIndex * 3),
                })
              ))
                .then(marchingCubes => {
                  const _updateGeometry = () => {
                    for (let i = 0; i < marchingCubes.length; i++) {
                      const marchingCube = marchingCubes[i];
                      const {origin} = marchingCube;
                      const planetMesh = planetsMesh.children.find(planetMesh => planetMesh.origin.equals(origin));
                      planetMesh.render(marchingCube);
                    }
                  };
                  const _makeParticles = () => {
                    const _makeParticleMesh = targetColor => {
                      const geometry = new THREE.TetrahedronBufferGeometry(0.3, 0);

                      const positions = geometry.getAttribute('position').array;
                      const numPositions = positions.length / 3;
                      const colors = new Float32Array(numPositions * 3);
                      for (let i = 0; i < numPositions; i++) {
                        const baseIndex = i * 3;
                        colors[baseIndex + 0] = targetColor.r;
                        colors[baseIndex + 1] = targetColor.g;
                        colors[baseIndex + 2] = targetColor.b;
                      }
                      geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

                      const material = planetMaterial;

                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.rotation.order = camera.rotation.order;
                      mesh.destroy = () => {
                        geometry.dispose();
                      };
                      return mesh;
                    };

                    const numParticleMeshes = 5 + Math.random() * 10;
                    for (let i = 0; i < numParticleMeshes; i++) {
                      const particleMesh = _makeParticleMesh(targetColor);
                      particleMesh.position.copy(
                        targetPosition.clone()
                          .add(
                            new THREE.Vector3(
                              (-0.5 + Math.random()) * 2,
                              (-0.5 + Math.random()) * 2,
                              (-0.5 + Math.random()) * 2
                            )
                          )
                        );
                      particleMesh.quaternion.setFromUnitVectors(
                        forwardVector,
                        new THREE.Vector3(
                          -0.5 + Math.random(),
                          -0.5 + Math.random(),
                          -0.5 + Math.random()
                        ).normalize()
                      );
                      const planetNormal = planetMesh.position.clone().add(origin.clone().multiplyScalar(SIZE))
                        .sub(particleMesh.position)
                        .normalize();
                      particleMesh.rayPosition = planetNormal.clone()
                        .add(
                          new THREE.Vector3(
                            (-0.5 + Math.random()),
                            (-0.5 + Math.random()),
                            (-0.5 + Math.random())
                          )
                        ).normalize();
                      particleMesh.rayRotation = new THREE.Vector3(
                        -0.5 + Math.random(),
                        -0.5 + Math.random(),
                        -0.5 + Math.random()
                      ).normalize();
                      particleMesh.linearVelocity = Math.random();
                      particleMesh.angularVelocity = Math.random();
                      particleMesh.startTime = Date.now();
                      particleMesh.endTime = particleMesh.startTime + (Math.random() * 2000);

                      scene.add(particleMesh);
                      particleMeshes.push(particleMesh);
                    }
                  };
                  const _makeItems = () => {
                    const _makeItemMesh = targetColor => {
                      const object = new THREE.Object3D();
                      object.rotation.y = (Math.PI * 2) * Math.random();
                      object.rotation.order = camera.rotation.order;

                      const outerMesh = (() => {
                        const geometry = new THREE.BoxBufferGeometry(0.2, 0.2, 0.2);
                        const material = glassMaterial;

                        const mesh = new THREE.Mesh(geometry, material);
                        return mesh;
                      })();
                      object.add(outerMesh);
                      object.outerMesh = outerMesh;

                      const innerMesh = (() => {
                        const geometry = new THREE.TetrahedronBufferGeometry(0.1, 1)
                          .applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI * 3 / 12));

                        const positions = geometry.getAttribute('position').array;
                        const numPositions = positions.length / 3;
                        const colors = new Float32Array(numPositions * 3);
                        for (let i = 0; i < numPositions; i++) {
                          const baseIndex = i * 3;
                          colors[baseIndex + 0] = targetColor.r;
                          colors[baseIndex + 1] = targetColor.g;
                          colors[baseIndex + 2] = targetColor.b;
                        }
                        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

                        const material = planetMaterial;

                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.rotation.order = camera.rotation.order;
                        return mesh;
                      })();
                      object.add(innerMesh);
                      object.innerMesh = innerMesh;

                      object.destroy = () => {
                        outerMesh.geometry.dispose();
                        innerMesh.geometry.dispose();
                      };

                      return object;
                    };

                    if (Math.random() < 0.5) {
                      const itemMesh = _makeItemMesh(targetColor);
                      itemMesh.position.copy(targetPosition);

                      scene.add(itemMesh);
                      itemMeshes.push(itemMesh);
                    }
                  };
                  const _playSound = () => {
                    soundObject.position.copy(targetPosition);
                    popAudio.currentTime = 0;
                    if (popAudio.paused) {
                      popAudio.play();
                    }
                  };

                  _updateGeometry();
                  _makeParticles();
                  _makeItems();
                  _playSound();
                })
                .catch(err => {
                  console.warn(err);
                });

              e.stopImmediatePropagation();
            }
          };
          input.on('trigger', _trigger);

          const now = Date.now();
          let lastUpdateTime = now;
          let lastHoverUpdateTime = now;
          const _update = () => {
            const now = Date.now();

            const _updateHover = () => {
              const timeDiff = now - lastHoverUpdateTime;
              if (timeDiff > 100) {
                const {gamepads} = pose.getStatus();

                SIDES.forEach(side => {
                  const gamepad = gamepads[side];
                  const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;

                  gpuPicker.camera.position.copy(controllerPosition);
                  gpuPicker.camera.quaternion.copy(controllerRotation);
                  gpuPicker.camera.updateMatrixWorld();
                  gpuPicker.needUpdate = true;
                  gpuPicker.update();

                  const intersection = gpuPicker.pick();
                  const dotMesh = dotMeshes[side];
                  const hoverState = hoverStates[side];

                  if (intersection) {
                    const {object, index} = intersection;
                    const positions = object.geometry.attributes.position.array;
                    const baseIndex = index * 9;
                    const va = new THREE.Vector3().fromArray(positions, baseIndex + 0).applyMatrix4(object.matrixWorld);
                    const vb = new THREE.Vector3().fromArray(positions, baseIndex + 3).applyMatrix4(object.matrixWorld);
                    const vc = new THREE.Vector3().fromArray(positions, baseIndex + 6).applyMatrix4(object.matrixWorld);
                    const triangle = new THREE.Triangle(va, vb, vc);
                    const intersectionPoint = new THREE.Ray(
                      controllerPosition.clone(),
                      forwardVector.clone().applyQuaternion(controllerRotation)
                    ).intersectPlane(triangle.plane());

                    if (intersectionPoint) {
                      const normal = triangle.normal();

                      dotMesh.position.copy(intersectionPoint);
                      dotMesh.quaternion.setFromUnitVectors(
                        upVector,
                        normal
                      );

                      const planetMesh = object.parent;
                      const {origin} = planetMesh;
                      const targetPosition = intersectionPoint.clone()
                        .sub(object.getWorldPosition())
                        .add(origin.clone().multiplyScalar(SIZE));

                      hoverState.planetMesh = planetMesh;
                      hoverState.intersectionObject = object;
                      hoverState.intersectionIndex = index;
                      hoverState.targetPosition = targetPosition;

                      if (!dotMesh.visible) {
                        dotMesh.visible = true;
                      }
                    } else {
                      hoverState.planetMesh = null;
                      hoverState.intersectionObject = null;
                      hoverState.intersectionIndex = null;
                      hoverState.targetPosition = null;

                      if (dotMesh.visible) {
                        dotMesh.visible = false;
                      }
                    }
                  } else {
                    hoverState.planetMesh = null;
                    hoverState.intersectionObject = null;
                    hoverState.intersectionIndex = null;
                    hoverState.targetPosition = null;

                    if (dotMesh.visible) {
                      dotMesh.visible = false;
                    }
                  }
                });

                lastHoverUpdateTime = now;
              }
            };
            const _updateParticles = () => {
              const oldParticleMeshes = particleMeshes.slice();
              for (let i = 0; i < oldParticleMeshes.length; i++) {
                const particleMesh = oldParticleMeshes[i];
                const {endTime} = particleMesh;

                if (now < endTime) {
                  const {startTime} = particleMesh;
                  const timeDiff = now - startTime;
                  const {rayPosition, rayRotation, linearVelocity, angularVelocity} = particleMesh;
                  particleMesh.position.add(rayPosition.clone().multiplyScalar(timeDiff * 0.0005 * linearVelocity));
                  particleMesh.rotation.x = (particleMesh.rotation.x + (rayRotation.x * timeDiff / (Math.PI * 2) * 0.001 * angularVelocity)) % (Math.PI * 2);
                  particleMesh.rotation.y = (particleMesh.rotation.y + (rayRotation.y * timeDiff / (Math.PI * 2) * 0.001 * angularVelocity)) % (Math.PI * 2);
                  particleMesh.rotation.z = (particleMesh.rotation.z + (rayRotation.z * timeDiff / (Math.PI * 2) * 0.001 * angularVelocity)) % (Math.PI * 2);
                } else {
                  scene.remove(particleMesh);
                  particleMesh.destroy();
                  particleMeshes.splice(particleMeshes.indexOf(particleMesh), 1);
                }
              }
            };
            const _updateItems = () => {
              const {hmd} = pose.getStatus();
              const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;
              const bodyPosition = hmdPosition.clone()
                .add(new THREE.Vector3(0, -0.25, 0).applyQuaternion(hmdRotation));
              const timeDiff = now - lastUpdateTime;

              const oldItemMeshes = itemMeshes.slice();
              for (let i = 0; i < oldItemMeshes.length; i++) {
                const itemMesh = oldItemMeshes[i];
                const distanceDiff = bodyPosition.distanceTo(itemMesh.position);

                const _removeItem = () => {
                  scene.remove(itemMesh);
                  itemMesh.destroy();
                  itemMeshes.splice(itemMeshes.indexOf(itemMesh), 1);
                };

                if (distanceDiff < 0.1) {
                  _removeItem();
                } else if (distanceDiff < 2) {
                  const moveVector = bodyPosition.clone().sub(itemMesh.position);
                  const moveVectorLength = moveVector.length();
                  const moveDistance = timeDiff * 0.01;

                  if (moveDistance < moveVectorLength) {
                    const instantMoveVector = moveVector.clone().multiplyScalar(moveDistance / moveVectorLength);
                    itemMesh.position.add(instantMoveVector);
                  } else {
                    _removeItem();
                  }
                }

                const {innerMesh} = itemMesh;
                innerMesh.rotation.y = (innerMesh.rotation.y + (timeDiff * 0.01 / (Math.PI * 2))) % (Math.PI * 2);
              }
            };

            _updateHover();
            _updateParticles();
            _updateItems();

            lastUpdateTime = now;
          };
          render.on('update', _update);

          cleanups.push(() => {
            scene.remove(planetsMesh);
            planetsMesh.children.forEach(planetMesh => {
              // teleport.removeTarget(planetMesh);
            });
            scene.remove(gpuPickerCamera);
            scene.remove(soundObject);
            particleMeshes.forEach(particleMesh => {
              scene.remove(particleMesh);
            });
            itemMeshes.forEach(itemMesh => {
              scene.remove(itemMesh);
            });

            if (!popAudio.paused) {
              popAudio.pause();
            }

            input.removeListener('trigger', _trigger);
            render.removeListener('update', _update);
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Planet;
