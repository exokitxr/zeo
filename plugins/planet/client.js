const SIZE = 16;
const NUM_POSITIONS = 4096;

const SIDES = ['left', 'right'];
const AXES = ['x', 'y', 'z'];

class Planet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three: {THREE, scene, camera, renderer}, pose, input, render, sound, intersect, teleport, utils: {geometry: geometryUtils}} = zeo;

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
    const oneVector = new THREE.Vector3(1, 1, 1);
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

    const _makeTargetState = () => ({
      targeting: false,
    });
    const targetStates = {
      left: _makeTargetState(),
      right: _makeTargetState(),
    };
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
      _requestAudio('archae/planet/audio/pop.ogg'),
      Promise.all(chunks.map(origin => _requestMarchingCubes({seed, origin}))),
    ])
      .then(([
        popAudio,
        marchingCubes,
      ]) => {
        if (live) {
          const intersecter = intersect.makeIntersecter({
            intersectMeshKey: '_planetIntersectMesh',
          });

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
            });

            return object;
          })();
          scene.add(planetsMesh);
          planetsMesh.updateMatrixWorld(true);
          for (let i = 0; i < planetsMesh.children.length; i++) {
            const planetMesh = planetsMesh.children[i];
            intersecter.addTarget(planetMesh);
            // teleport.addTarget(planetMesh);
          }
          intersecter.reindex();
          // teleport.reindex();

          const particlesMesh = (() => {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(NUM_POSITIONS * 3);
            const positionsAttribute = new THREE.BufferAttribute(positions, 3);
            geometry.addAttribute('position', positionsAttribute);
            const normals = new Float32Array(NUM_POSITIONS * 3);
            const normalsAttribute = new THREE.BufferAttribute(normals, 3);
            geometry.addAttribute('normal', normalsAttribute);
            const colors = new Float32Array(NUM_POSITIONS * 3);
            const colorsAttribute = new THREE.BufferAttribute(colors, 3);
            geometry.addAttribute('color', colorsAttribute);
            geometry.setDrawRange(0, 0);
            geometry.boundingSphere = new THREE.Sphere(
              new THREE.Vector3(0, 0, 0),
              1
            );
            // geometry.computeBoundingSphere();

            const material = planetMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;

            const particleGeometry = geometryUtils.unindexBufferGeometry(new THREE.TetrahedronBufferGeometry(0.3, 0));
            const numParticleGeometryVertices = particleGeometry.getAttribute('position').count;

            class Particle {
              constructor(
                position,
                normal,
                scale,
                color,
                rotation,
                rayPosition,
                rayRotation,
                linearVelocity,
                angularVelocity,
                startTime,
                endTime
              ) {
                this.position = position;
                this.normal = normal;
                this.scale = scale;
                this.color = color;
                this.rotation = rotation;
                this.rayPosition = rayPosition;
                this.rayRotation = rayRotation;
                this.linearVelocity = linearVelocity;
                this.angularVelocity = angularVelocity;
                this.startTime = startTime;
                this.endTime = endTime;
              }

              isValid(now) {
                return now < this.endTime;
              }

              getMatrix(now) {
                const {position, rotation, scale, rayPosition, rayRotation, linearVelocity, angularVelocity, startTime} = this;
                const timeDiff = now - startTime;
                const newPosition = position.clone().add(rayPosition.clone().multiplyScalar(timeDiff * 0.001 * linearVelocity));
                const newRotation = rotation.clone();
                newRotation.x = (rotation.x + (rayRotation.x * timeDiff / (Math.PI * 2) * 0.001 * angularVelocity)) % (Math.PI * 2);
                newRotation.y = (rotation.y + (rayRotation.y * timeDiff / (Math.PI * 2) * 0.001 * angularVelocity)) % (Math.PI * 2);
                newRotation.z = (rotation.z + (rayRotation.z * timeDiff / (Math.PI * 2) * 0.001 * angularVelocity)) % (Math.PI * 2);
                const newQuaternion = new THREE.Quaternion().setFromEuler(newRotation);
                const newScale = scale;

                return new THREE.Matrix4().compose(
                  newPosition,
                  newQuaternion,
                  newScale
                );
              }
            }

            const particles = [];
            mesh.addParticle = (
              position,
              normal,
              scale,
              color,
              rotation,
              rayPosition,
              rayRotation,
              linearVelocity,
              angularVelocity,
              startTime,
              endTime,
            ) => {
              if (((particles.length + 1) * numParticleGeometryVertices * 3) > NUM_POSITIONS) {
                particles.shift();
              }

              const particle = new Particle(
                position,
                normal,
                scale,
                color,
                rotation,
                rayPosition,
                rayRotation,
                linearVelocity,
                angularVelocity,
                startTime,
                endTime
              );
              particles.push(particle);
            };
            mesh.update = () => {
              const now = Date.now();

              const oldParticles = particles.slice();
              let index = 0;
              for (let i = 0; i < oldParticles.length; i++) {
                const particle = oldParticles[i];

                if (particle.isValid(now)) {
                  const matrix = particle.getMatrix(now);

                  const newGeometry = particleGeometry.clone()
                    .applyMatrix(matrix);
                  const newPositions = newGeometry.getAttribute('position').array;
                  const newNormals = newGeometry.getAttribute('normal').array;

                  positions.set(newPositions, index * numParticleGeometryVertices * 3);
                  normals.set(newNormals, index * numParticleGeometryVertices * 3);

                  const {color: newColor} = particle;
                  for (let j = 0; j < numParticleGeometryVertices; j++) {
                    const baseIndex = (index * numParticleGeometryVertices * 3) + (j * 3);
                    colors[baseIndex + 0] = newColor.r;
                    colors[baseIndex + 1] = newColor.g;
                    colors[baseIndex + 2] = newColor.b;
                  }

                  index++;
                } else {
                  particles.splice(particles.indexOf(particle), 1);
                }
              }

              positionsAttribute.needsUpdate = true;
              normalsAttribute.needsUpdate = true;
              colorsAttribute.needsUpdate = true;

              geometry.setDrawRange(0, particles.length * numParticleGeometryVertices);
            };

            // mesh.rotation.order = camera.rotation.order;
            return mesh;
          })();
          scene.add(particlesMesh);
          particlesMesh.updateMatrixWorld();

          const itemsMesh = (() => {
            const object = new THREE.Object3D();

            const glassGeometry = geometryUtils.unindexBufferGeometry(new THREE.BoxBufferGeometry(0.2, 0.2, 0.2));
            const numGlassGeometryVertices = glassGeometry.getAttribute('position').count;
            const glassMesh = (() => {
              const geometry = new THREE.BufferGeometry();
              const positions = new Float32Array(NUM_POSITIONS * 3);
              const positionsAttribute = new THREE.BufferAttribute(positions, 3);
              geometry.addAttribute('position', positionsAttribute);
              const normals = new Float32Array(NUM_POSITIONS * 3);
              const normalsAttribute = new THREE.BufferAttribute(normals, 3);
              geometry.addAttribute('normal', normalsAttribute);
              geometry.setDrawRange(0, 0);
              geometry.boundingSphere = new THREE.Sphere(
                new THREE.Vector3(0, 0, 0),
                1
              );

              const material = glassMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.frustumCulled = false;
              return mesh;
            })();
            object.add(glassMesh);

            const coreGeometry = geometryUtils.unindexBufferGeometry(
              new THREE.TetrahedronBufferGeometry(0.1, 1)
                .applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI * 3 / 12))
            );
            const numCoreGeometryVertices = coreGeometry.getAttribute('position').count;
            const coreMesh = (() => {
              const geometry = new THREE.BufferGeometry();
              const positions = new Float32Array(NUM_POSITIONS * 3);
              const positionsAttribute = new THREE.BufferAttribute(positions, 3);
              geometry.addAttribute('position', positionsAttribute);
              const normals = new Float32Array(NUM_POSITIONS * 3);
              const normalsAttribute = new THREE.BufferAttribute(normals, 3);
              geometry.addAttribute('normal', normalsAttribute);
              const colors = new Float32Array(NUM_POSITIONS * 3);
              const colorsAttribute = new THREE.BufferAttribute(colors, 3);
              geometry.addAttribute('color', colorsAttribute);
              geometry.setDrawRange(0, 0);
              geometry.boundingSphere = new THREE.Sphere(
                new THREE.Vector3(0, 0, 0),
                1
              );

              const material = planetMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.frustumCulled = false;
              return mesh;
            })();
            object.add(coreMesh);

            class Item {
              constructor(
                position,
                rotation,
                color,
                startTime
              ) {
                this.position = position;
                this.rotation = rotation;
                this.color = color;
                this.startTime = startTime;
              }

              getOuterMatrix() {
                const {position, rotation} = this;
                const quaternion = new THREE.Quaternion().setFromEuler(rotation);

                return new THREE.Matrix4().compose(
                  position,
                  quaternion,
                  oneVector
                );
              }

              getInnerMatrix(now) {
                const {position, rotation, startTime} = this;
                const timeDiff = now - startTime;
                const newPosition = position;
                const newRotation = rotation.clone();
                newRotation.y = (rotation.y + (timeDiff / (Math.PI * 2) * 0.01)) % (Math.PI * 2);
                const newQuaternion = new THREE.Quaternion().setFromEuler(newRotation);
                const newScale = oneVector;

                return new THREE.Matrix4().compose(
                  newPosition,
                  newQuaternion,
                  newScale
                );
              }
            }

            const items = [];

            object.addItem = (position, rotation, color, startTime) => {
              if (
                ((items.length + 1) * numGlassGeometryVertices * 3) > NUM_POSITIONS ||
                ((items.length + 1) * numCoreGeometryVertices * 3) > NUM_POSITIONS
              ) {
                items.shift();
              }

              const item = new Item(position, rotation, color, startTime);
              items.push(item);
            };
            let lastUpdateTime = Date.now();
            object.update = bodyPosition => {
              const now = Date.now();

              const _updateItems = () => {
                const {hmd} = pose.getStatus();
                const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;
                const bodyPosition = hmdPosition.clone()
                  .add(new THREE.Vector3(0, -0.25, 0).applyQuaternion(hmdRotation));
                const timeDiff = now - lastUpdateTime;

                const oldItems = items.slice();
                for (let i = 0; i < oldItems.length; i++) {
                  const item = oldItems[i];
                  const distanceDiff = bodyPosition.distanceTo(item.position);

                  const _removeItem = () => {
                    items.splice(items.indexOf(item), 1);
                  };

                  if (distanceDiff < 0.1) {
                    _removeItem();
                  } else if (distanceDiff < 2) {
                    const moveVector = bodyPosition.clone().sub(item.position);
                    const moveVectorLength = moveVector.length();
                    const moveDistance = timeDiff * 0.01;

                    if (moveDistance < moveVectorLength) {
                      const instantMoveVector = moveVector.clone().multiplyScalar(moveDistance / moveVectorLength);
                      item.position.add(instantMoveVector);
                    } else {
                      _removeItem();
                    }
                  }
                }
              };
              const _updateGlass = () => {
                const {geometry} = glassMesh;
                const positionsAttribute = geometry.getAttribute('position');
                const {array: positions} = positionsAttribute;
                const normalsAttribute = geometry.getAttribute('normal');
                const {array: normals} = normalsAttribute;

                for (let i = 0; i < items.length; i++) {
                  const item = items[i];
                  const matrix = item.getOuterMatrix();

                  const newGeometry = glassGeometry.clone()
                    .applyMatrix(matrix);
                  const newPositions = newGeometry.getAttribute('position').array;
                  const newNormals = newGeometry.getAttribute('normal').array;

                  positions.set(newPositions, i * numGlassGeometryVertices * 3);
                  normals.set(newNormals, i * numGlassGeometryVertices * 3);
                }

                positionsAttribute.needsUpdate = true;
                normalsAttribute.needsUpdate = true;

                geometry.setDrawRange(0, items.length * numGlassGeometryVertices);
              };
              const _updateCore = () => {
                const now = Date.now();

                const {geometry} = coreMesh;
                const positionsAttribute = geometry.getAttribute('position');
                const {array: positions} = positionsAttribute;
                const normalsAttribute = geometry.getAttribute('normal');
                const {array: normals} = normalsAttribute;
                const colorsAttribute = geometry.getAttribute('color');
                const {array: colors} = colorsAttribute;

                for (let i = 0; i < items.length; i++) {
                  const item = items[i];
                  const matrix = item.getInnerMatrix(now);

                  const newGeometry = coreGeometry.clone()
                    .applyMatrix(matrix);
                  const newPositions = newGeometry.getAttribute('position').array;
                  const newNormals = newGeometry.getAttribute('normal').array;

                  positions.set(newPositions, i * numCoreGeometryVertices * 3);
                  normals.set(newNormals, i * numCoreGeometryVertices * 3);

                  const {color: newColor} = item;
                  for (let j = 0; j < numCoreGeometryVertices; j++) {
                    const baseIndex = (i * numCoreGeometryVertices * 3) + (j * 3);
                    colors[baseIndex + 0] = newColor.r;
                    colors[baseIndex + 1] = newColor.g;
                    colors[baseIndex + 2] = newColor.b;
                  }
                }

                positionsAttribute.needsUpdate = true;
                normalsAttribute.needsUpdate = true;
                colorsAttribute.needsUpdate = true;

                geometry.setDrawRange(0, items.length * numCoreGeometryVertices);
              };

              _updateItems();
              _updateGlass();
              _updateCore();

              lastUpdateTime = now;
            };

            return object;
          })();
          scene.add(itemsMesh);
          itemsMesh.updateMatrixWorld();

          const soundObject = new THREE.Object3D();
          scene.add(soundObject);

          const soundBody = (() => {
            const result = sound.makeBody();

            result.setInputElement(popAudio);
            result.setObject(soundObject);

            return result;
          })();

          const _triggerdown = e => {
            const {side} = e;
            const targetState = targetStates[side];
            targetState.targeting = true;
          };
          input.on('triggerdown', _triggerdown, {
            priority: -1,
          });
          const _triggerup = e => {
            const {side} = e;
            const targetState = targetStates[side];
            targetState.targeting = false;
          };
          input.on('triggerup', _triggerup, {
            priority: -1,
          });
          const _trigger = e => {
            const {side} = e;
            const hoverState = hoverStates[side];
            const {planetMesh} = hoverState;

            if (planetMesh) {
              const {intersectionObject, intersectionIndex, targetPosition} = hoverState;
              const {geometry: intersectionObjectGeometry} = intersectionObject;
              const {origin} = planetMesh;

              const localPlanetPosition = targetPosition.clone()
                .applyMatrix4(new THREE.Matrix4().getInverse(planetMesh.matrixWorld))
              localPlanetPosition.x = Math.round(localPlanetPosition.x);
              localPlanetPosition.y = Math.round(localPlanetPosition.y);
              localPlanetPosition.z = Math.round(localPlanetPosition.z);
              const absolutePlanetPosition = localPlanetPosition.clone()
                .add(origin.clone().multiplyScalar(SIZE));
              const colorsAttribute = intersectionObjectGeometry.getAttribute('color');
              const targetColor = colorsAttribute ?
                new THREE.Color().fromArray(colorsAttribute.array.slice(intersectionIndex * 9, (intersectionIndex + 1) * 9))
              :
                waterMaterial.color;

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

                      intersecter.removeTarget(planetMesh);
                      intersecter.addTarget(planetMesh);

                      // teleport.removeTarget(planetMesh);
                      // teleport.addTarget(planetMesh);
                    }

                    intersecter.reindex();
                    // teleport.reindex();
                  };
                  const _makeParticles = () => {
                    const numParticleMeshes = 5 + Math.random() * 10;
                    for (let i = 0; i < numParticleMeshes; i++) {
                      const position = targetPosition.clone()
                        .add(
                          new THREE.Vector3(
                            (-0.5 + Math.random()) * 2,
                            (-0.5 + Math.random()) * 2,
                            (-0.5 + Math.random()) * 2
                          )
                        );
                      const normal = planetMesh.position.clone().add(origin.clone().multiplyScalar(SIZE))
                        .sub(position)
                        .normalize();
                      const axis = AXES[Math.floor(Math.random() * AXES.length)];
                      const scale = new THREE.Vector3(
                        0.5 + (Math.random() * (axis === 'x' ? 3 : 1)),
                        0.5 + (Math.random() * (axis === 'y' ? 3 : 1)),
                        0.5 + (Math.random() * (axis === 'z' ? 3 : 1))
                      );
                      const color = targetColor;
                      const rotation = new THREE.Euler(
                        -0.5 + Math.random(),
                        -0.5 + Math.random(),
                        -0.5 + Math.random(),
                        camera.rotation.order
                      );
                      const rayPosition = normal.clone()
                        .add(
                          new THREE.Vector3(
                            (-0.5 + Math.random()),
                            (-0.5 + Math.random()),
                            (-0.5 + Math.random())
                          )
                        ).normalize();
                      const rayRotation = new THREE.Vector3(
                        -0.5 + Math.random(),
                        -0.5 + Math.random(),
                        -0.5 + Math.random()
                      ).normalize();
                      const linearVelocity = Math.random();
                      const angularVelocity = Math.random();
                      const startTime = Date.now();
                      const endTime = startTime + (2 * 1000) + (Math.random() * 8 * 1000);

                      particlesMesh.addParticle(
                        position,
                        normal,
                        scale,
                        color,
                        rotation,
                        rayPosition,
                        rayRotation,
                        linearVelocity,
                        angularVelocity,
                        startTime,
                        endTime,
                      );
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
                      const position = targetPosition;
                      const rotation = new THREE.Euler(0, Math.random(), 0, camera.rotation.order);
                      const color = targetColor;
                      const startTime = Date.now();

                      itemsMesh.addItem(
                        position,
                        rotation,
                        color,
                        startTime
                      );
                    }
                  };
                  const _playSound = () => {
                    soundObject.position.copy(targetPosition);
                    soundObject.updateMatrixWorld();

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
          input.on('trigger', _trigger, {
            priority: -1,
          });

          const _update = () => {
            const _updateHover = () => {
              SIDES.forEach(side => {
                const targetState = targetStates[side];
                const {targeting} = targetState;
                const hoverState = hoverStates[side];
                const dotMesh = dotMeshes[side];

                const _hide = () => {
                  hoverState.planetMesh = null;
                  hoverState.intersectionObject = null;
                  hoverState.intersectionIndex = null;
                  hoverState.targetPosition = null;

                  if (dotMesh.visible) {
                    dotMesh.visible = false;
                  }
                };

                if (targeting) {
                  intersecter.update(side);

                  const intersecterHoverState = intersecter.getHoverState(side);
                  const {object} = intersecterHoverState;

                  if (object) {
                    const {originalObject, position, normal, index} = intersecterHoverState;

                    dotMesh.position.copy(position);
                    dotMesh.quaternion.setFromUnitVectors(
                      upVector,
                      normal
                    );
                    dotMesh.updateMatrixWorld();

                    const planetMesh = originalObject;
                    const {origin} = planetMesh;
                    const targetPosition = position.clone()
                      .sub(new THREE.Vector3().setFromMatrixPosition(object.matrixWorld))
                      .add(origin.clone().multiplyScalar(SIZE));

                    hoverState.planetMesh = planetMesh;
                    hoverState.intersectionObject = object;
                    hoverState.intersectionIndex = index;
                    hoverState.targetPosition = targetPosition;

                    if (!dotMesh.visible) {
                      dotMesh.visible = true;
                    }
                  } else {
                    _hide();
                  }
                } else {
                  _hide();
                }
              });
            };
            const _updateParticles = () => {
              particlesMesh.update();
            };
            const _updateItems = () => {
              itemsMesh.update();
            };

            _updateHover();
            _updateParticles();
            _updateItems();
          };
          render.on('update', _update);

          cleanups.push(() => {
            scene.remove(planetsMesh);
            planetsMesh.children.forEach(planetMesh => {
              // teleport.removeTarget(planetMesh);
            })
            intersect.destroyIntersecter(intersecter);
            scene.remove(soundObject);
            scene.remove(particlesMesh);
            scene.remove(itemsMesh);

            if (!popAudio.paused) {
              popAudio.pause();
            }

            input.removeListener('triggerdown', _triggerdown);
            input.removeListener('triggerup', _triggerup);
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
