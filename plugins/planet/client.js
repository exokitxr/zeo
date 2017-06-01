const SIZE = 16;

const SIDES = ['left', 'right'];

class Planet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three: {THREE, scene, camera}, pose, input, render, sound, utils: {geometry: geometryUtils}} = zeo;

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
    });
    const waterMaterial = new THREE.MeshPhongMaterial({
      color: 0x44447A,
      shading: THREE.FlatShading,
      transparent: true,
      opacity: 0.95,
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
      intersectionObject: null,
      targetPosition: null,
      targetColor: null,
    });
    const hoverStates = {
      left: _makeHoverState(),
      right: _makeHoverState(),
    };

    const particleMeshes = [];

    cleanups.push(() => {
      planetMaterial.dispose();
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
              };
              const _renderWater = marchingCube => {
                const {water} = marchingCube;
                const {positions, normals} = water;
                const {geometry} = waterMesh;

                geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
              };

              _renderLand(marchingCube);
              _renderWater(marchingCube);
            };

            return object;
          };
          const planetMeshes = marchingCubes.map(marchingCube => {
            const {origin} = marchingCube;

            const planetMesh = _makePlanetMesh();
            planetMesh.origin = origin;
            planetMesh.render(marchingCube);

            planetMesh.position.copy(origin.clone().multiplyScalar(SIZE));

            return planetMesh;
          });
          planetMeshes.forEach(planetMesh => {
            scene.add(planetMesh);
          });
          const planetTargetMeshes = (() => {
            const result = Array(planetMeshes.length * 2);
            for (let i = 0; i < planetMeshes.length; i++) {
              const planetMesh = planetMeshes[i];
              const baseIndex = i * 2;
              result[baseIndex + 0] = planetMesh.landMesh;
              result[baseIndex + 1] = planetMesh.waterMesh;
            }
            return result;
          })();

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
            const {intersectionObject} = hoverState;

            if (intersectionObject) {
              const planetMesh = intersectionObject;
              const {origin} = planetMesh;
              const {targetPosition, targetColor} = hoverState;

              const localPlanetPosition = targetPosition.clone()
                .applyMatrix4(new THREE.Matrix4().getInverse(intersectionObject.matrixWorld))
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
                      const planetMesh = planetMeshes.find(planetMesh => planetMesh.origin.equals(origin));
                      planetMesh.render(marchingCube);
                    }
                  };
                  const _makeParticles = () => {
                    const _makeParticleMesh = targetColor => {
                      const geometry = new THREE.TetrahedronBufferGeometry(0.1);

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
                      return mesh;
                    };

                    for (let i = 0; i < 8; i++) {
                      const particleMesh = _makeParticleMesh(targetColor);
                      particleMesh.position.copy(
                        targetPosition.clone()
                          .add(
                            new THREE.Vector3(
                              (-0.5 + Math.random()) * 1,
                              (-0.5 + Math.random()) * 1,
                              (-0.5 + Math.random()) * 1
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
                      particleMesh.startTime = Date.now();

                      scene.add(particleMesh);
                      particleMeshes.push(particleMesh);
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
                  _playSound();
                })
                .catch(err => {
                  console.warn(err);
                });

              e.stopImmediatePropagation();
            }
          };
          input.on('trigger', _trigger);
          const _update = () => {
            const _updateHover = () => {
              const {gamepads} = pose.getStatus();

              SIDES.forEach(side => {
                const gamepad = gamepads[side];
                const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                const raycaster = new THREE.Raycaster(controllerPosition, forwardVector.clone().applyQuaternion(controllerRotation));
                const intersections = raycaster.intersectObjects(planetTargetMeshes);
                const dotMesh = dotMeshes[side];
                const hoverState = hoverStates[side];

                if (intersections.length > 0) {
                  const intersection = intersections[0];
                  const {point: intersectionPoint, index: intersectionIndex, face: intersectionFace, object: intersectionObject} = intersection;
                  const {normal} = intersectionFace;
                  const {geometry} = intersectionObject;

                  const intersectionObjectRotation = intersectionObject.getWorldQuaternion();
                  const worldNormal = normal.clone().applyQuaternion(intersectionObjectRotation);
                  dotMesh.position.copy(intersectionPoint);
                  dotMesh.quaternion.setFromUnitVectors(
                    upVector,
                    worldNormal
                  );

                  const {parent: planetMesh} = intersectionObject;
                  const {origin} = planetMesh;
                  const targetPosition = intersectionPoint.clone()
                    .sub(intersectionObject.getWorldPosition())
                    .add(origin.clone().multiplyScalar(SIZE));
                  hoverState.intersectionObject = planetMesh;
                  hoverState.targetPosition = targetPosition;
                  hoverState.targetColor = new THREE.Color()
                    .fromArray(geometry.getAttribute('color').array.slice(intersectionIndex * 3, (intersectionIndex + 1) * 3));

                  if (!dotMesh.visible) {
                    dotMesh.visible = true;
                  }
                } else {
                  hoverState.intersectionObject = null;
                  hoverState.targetPosition = null;
                  hoverState.targetColor = null;

                  if (dotMesh.visible) {
                    dotMesh.visible = false;
                  }
                }
              });
            };
            const _updateParticles = () => {
              const now = Date.now();

              const oldParticleMeshes = particleMeshes.slice();
              for (let i = 0; i < oldParticleMeshes.length; i++) {
                const particleMesh = oldParticleMeshes[i];
                const {startTime} = particleMesh;
                const timeDiff = now - startTime;

                if (timeDiff > 2000) {
                  scene.remove(particleMesh);
                  particleMeshes.splice(particleMeshes.indexOf(particleMesh), 1);
                }
              }
            };

            _updateHover();
            _updateParticles();
          };
          render.on('update', _update);

          cleanups.push(() => {
            planetMeshes.forEach(planetMesh => {
              scene.remove(planetMesh);
            });
            scene.remove(soundObject);
            particleMeshes.forEach(particleMesh => {
              scene.remove(particleMesh);
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
