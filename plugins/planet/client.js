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
    const {three, elements, pose, input, render, player, sound, intersect, teleport, utils: {geometry: geometryUtils, network: networkUtils}} = zeo;
    const {THREE, scene, camera, renderer} = three;
    const {AutoWs} = networkUtils;

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
      side: THREE.DoubleSide,
    });
    const waterMaterial = new THREE.MeshPhongMaterial({
      color: 0x44447A,
      shading: THREE.FlatShading,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
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

    const _parsePlanetDataSpecs = data => {
      let index = 0;
      const numPlanetDataSpecs = new Uint32Array(data, 0, 1)[0];
      index += 4;

      const specs = Array(numPlanetDataSpecs);
      for (let i = 0; i < numPlanetDataSpecs; i++) {
        const originArray = new Int32Array(data, index, 3);
        const origin = new THREE.Vector3(originArray[0], originArray[1], originArray[2]);
        index += 3 * 4;

        const numLandPositions = new Uint32Array(data, index, 1)[0];
        index += 4;
        const numLandNormals = new Uint32Array(data, index, 1)[0];
        index += 4;
        const numLandColors = new Uint32Array(data, index, 1)[0];
        index += 4;
        const numWaterPositions = new Uint32Array(data, index, 1)[0];
        index += 4;
        const numWaterNormals = new Uint32Array(data, index, 1)[0];
        index += 4;

        const landPositions = new Float32Array(data, index, numLandPositions);
        index += numLandPositions * 4;
        const landNormals = new Float32Array(data, index, numLandNormals);
        index += numLandNormals * 4;
        const landColors = new Float32Array(data, index, numLandColors);
        index += numLandColors * 4;

        const waterPositions = new Float32Array(data, index, numWaterPositions);
        index += numWaterPositions * 4;
        const waterNormals = new Float32Array(data, index, numWaterNormals);
        index += numWaterNormals * 4;

        const planetDataSpec = {
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
        specs[i] = planetDataSpec;
      }

      const numHoles = new Uint32Array(data, index, 1)[0];
      index += 4;
      const holes = new Int32Array(data, index, numHoles * 3);
      index += numHoles * 3 * 4;

      const numColors = new Uint32Array(data, index, 1)[0];
      index += 4;
      const colors = new Uint8Array(data, index, numColors * 3);
      index += numColors * 3;

      return {
        specs,
        holes,
        colors,
      };
    };
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

    return _requestAudio('archae/planet/audio/pop.ogg')
      .then(popAudio => {
        if (live) {
          const planetEntity = {
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 0, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              'planet-id': {
                type: 'text',
                value: _makeId,
              },
              file: {
                type: 'file',
                value: () => elements.makeFile({
                  ext: 'json',
                }).then(file => file.url),
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getEntityApi();
              const entityObject = entityElement.getObject();

              const intersecter = intersect.makeIntersecter();

              const _makePlanetMesh = origin => {
                const object = new THREE.Object3D();
                object.origin = origin;

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

                    const oldPositionsAttribute = geometry.getAttribute('position');
                    const oldPositions = oldPositionsAttribute ? oldPositionsAttribute.array : [];

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
              const planetsMesh = new THREE.Object3D();
              scene.add(planetsMesh);

              const _loadMesh = data => {
                const {specs, holes, colors} = _parsePlanetDataSpecs(data);
                const {children: planetMeshes} = planetsMesh;

                const _updateGeometry = () => {
                  const addedPlanetMeshes = [];
                  const updatedPlanetMeshes = [];
                  for (let i = 0; i < specs.length; i++) {
                    const spec = specs[i];
                    const {origin} = spec;
                    let planetMesh = planetMeshes.find(planetMesh => planetMesh.origin.equals(origin));

                    if (!planetMesh) {
                      planetMesh = _makePlanetMesh(origin);
                      planetMesh.position.copy(origin.clone().multiplyScalar(SIZE));
                      planetMesh.render(spec);

                      planetsMesh.add(planetMesh);
                      addedPlanetMeshes.push(planetMesh);
                    } else {
                      planetMesh.render(spec);
                      updatedPlanetMeshes.push(planetMesh);
                    }
                  }

                  planetsMesh.updateMatrixWorld();
                  for (let i = 0; i < addedPlanetMeshes.length; i++) {
                    const planetMesh = addedPlanetMeshes[i];
                    intersecter.addTarget(planetMesh);
                  }
                  for (let i = 0; i < updatedPlanetMeshes.length; i++) {
                    const planetMesh = updatedPlanetMeshes[i];
                    intersecter.removeTarget(planetMesh);
                    intersecter.addTarget(planetMesh);
                  }
                  intersecter.reindex();
                };
                const _updateInteractions = () => {
                  const _makeParticles = (targetPosition, targetColor) => {
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
                      const normal = targetPosition.clone().normalize();
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
                        endTime
                      );
                    }
                  };
                  const _makeItems = (targetPosition, targetColor) => {
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
                  const _playSound = targetPosition => {
                    soundObject.position.copy(targetPosition);
                    soundObject.updateMatrixWorld();

                    popAudio.currentTime = 0;
                    if (popAudio.paused) {
                      popAudio.play();
                    }
                  };

                  const numHoles = holes.length / 3;
                  for (let i = 0; i < numHoles; i++) {
                    const baseIndex = i * 3;
                    const hole = new THREE.Vector3(
                      holes[baseIndex + 0],
                      holes[baseIndex + 1],
                      holes[baseIndex + 2]
                    );
                    const color = new THREE.Color(
                      colors[baseIndex + 0] / 255,
                      colors[baseIndex + 1] / 255,
                      colors[baseIndex + 2] / 255
                    );

                    _makeParticles(hole, color);
                    _makeItems(hole, color);
                    _playSound(hole);
                  }
                };

                _updateGeometry();
                _updateInteractions();
              };
              const _clearMeshes = () => {
                const oldPlanetMeshes = planetsMesh.children.slice();

                for (let i = 0; i < oldPlanetMeshes.length; i++) {
                  const planetMesh = oldPlanetMeshes[i];
                  planetsMesh.remove(planetMesh);
                  planetMesh.destroy();
                  intersecter.removeTarget(planetMesh);
                }
                intersecter.reindex();
              };
              const _addHole = (x, y, z, color) => {
                const data = new Uint8Array(
                  4 + // num holes
                  1 * 3 * 4 + // holes payload
                  4 + // num colors
                  1 * 3 // colors payload
                );

                let index = 0;
                new Uint32Array(data.buffer, data.byteOffset + index, 1).set(Uint32Array.from([1]));
                index += 4;
                new Int32Array(data.buffer, data.byteOffset + index, 3).set(Int32Array.from([x, y, z]));
                index += 1 * 3 * 4;

                new Uint32Array(data.buffer, data.byteOffset + index, 1).set(Uint32Array.from([1]));
                index += 4;
                new Uint8Array(data.buffer, data.byteOffset + index, 3).set(Uint8Array.from([color.r * 255, color.g * 255, color.b * 255]));
                index += 1 * 3;

                connection.send(data);
              };

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
                  endTime
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

                result.setInputElement(popAudio); // XXX clone this
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
                    absolutePlanetPosition.z,
                    targetColor
                  );

                  /* const originsToUpdate = (() => {
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
                        }

                        intersecter.reindex();
                      };

                      _updateGeometry();
                      _makeParticles();
                      _makeItems();
                      _playSound();
                    })
                    .catch(err => {
                      console.warn(err);
                    }); */

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

              let connection = null;
              const _ensureConnect = () => {
                const {file} = entityApi;

                if (file && !connection) {
                  const peerId = player.getId();
                  const {planetId} = entityApi;
                  connection = new AutoWs(_relativeWsUrl('archae/planetWs?peerId=' + encodeURIComponent(peerId) + '&planetId=' + encodeURIComponent(planetId)));

                  const bs = [];
                  connection.on('message', msg => {
                    const {data} = msg;

                    if (data.byteLength > 0) {
                      bs.push(data);
                    } else {
                      const b = _arrayBufferConcat(bs);
                      bs.length = 0;
                      _loadMesh(b);
                    }
                  });
                } else if (!file && connection) {
                  _clearMeshes();

                  connection.destroy();
                  connection = null;
                }
              };
              entityApi.ensureConnect = _ensureConnect;

              entityApi._cleanup = () => {
                scene.remove(planetsMesh);
                /* planetsMesh.children.forEach(planetMesh => {
                  teleport.removeTarget(planetMesh);
                });
                teleport.reindex(); */
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

                  entityObject.position.set(position[0], position[1], position[2]);
                  entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                  entityObject.scale.set(position[7], position[8], position[9]);
                  entityObject.updateMatrixWorld();

                  break;
                }
                case 'planet-id': {
                  entityApi.planetId = newValue;

                  break;
                }
                case 'file': {
                  entityApi.file = newValue;

                  entityApi.ensureConnect();

                  break;
                }
              }
            },
          };
          elements.registerEntity(this, planetEntity);

          this._cleanup = () => {
            elements.unregisterEntity(this, planetEntity);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};
const _makeId = () => Math.random().toString(36).substring(7);
const _arrayBufferConcat = bs => {
  const totalSize = (() => {
    let result = 0;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      result += b.byteLength;
    }
    return result;
  })();

  const resultArray = new Uint8Array(totalSize);
  let index = 0;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    const bArray = new Uint8Array(b);
    resultArray.set(bArray, index);
    index += bArray.length;
  }

  return resultArray.buffer;
};

module.exports = Planet;
