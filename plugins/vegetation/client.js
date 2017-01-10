import Alea from 'alea';

export default class Vegetation {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/zeo',
      ]),
      archae.requestPlugins([
        '/core/plugins/fun-utils',
      ]),
    ])
      .then(([
        [zeo],
        [funUtils],
      ]) => {
        if (live) {
          const {THREE, scene} = zeo;

          return {
            elements: [
              class TreeElement extends HTMLElement {
                static get tag() {
                  return 'vegetation.tree';
                }
                static get attributes() {
                  return {
                    position: {
                      type: 'matrix',
                      value: [
                        0, 0, 0,
                        0, 0, 0, 1,
                        1, 1, 1,
                      ],
                    },
                  };
                }

                createdCallback() {
                  const trunkColors = [
                    '#337346',
                    '#0e6525',
                    '#8eb264',
                    '#547a18',
                    '#136659',
                    '#596652',
                    '#32554a',
                    '#bdb164',

                    '#225e34',
                    '#24541f',
                    '#b6da8c',
                    '#2d410b',
                    '#173933',
                    '#454f3f',
                    '#5a7d72',
                    '#a79c67',
                  ];

                  const treeMaterial = new THREE.MeshLambertMaterial({
                    color: 0xFFFFFF,
                    // emissive: 0x333333,
                    // specular: 0x000000,
                    // shininess: 0,
                    // side: THREE.DoubleSide,
                    shading: THREE.FlatShading,
                    vertexColors: THREE.VertexColors,
                  });

                  // XXX abstract these into sampleUtils
                  const _normalizeChunkTypes = types => {
                    const totalTypesValue = (() => {
                      let result = 0;
                      for (let i = 0; i < types.length; i++) {
                        const type = types[i];
                        const {value} = type;
                        result += value;
                      }
                      return result;
                    })();

                    let acc = 0;
                    return types.map((type, i, a) => {
                      const {name} = type;
                      const threshold = (() => {
                        if (i !== (a - 1)) {
                          const {value} = type;
                          acc += value / totalTypesValue;
                          return acc;
                        } else {
                          return 1;
                        }
                      })();
                      return {
                        name,
                        threshold,
                      };
                    });
                  };
                  const _getChunkType = (noiseValue, types) => {
                    for (let i = 0; i < types.length; i++) {
                      const type = types[i];
                      const {name, threshold} = type;
                      if (noiseValue < threshold) {
                        return name;
                      }
                    }
                    return null;
                  };

                  const vegetationChunkTypes = [
                    {
                      name: 'trunk',
                      value: 3,
                    },
                    {
                      name: 'leaf',
                      value: 1,
                    },
                    /* {
                      name: 'fruit',
                      value: 1,
                    }, */
                    /* {
                      name: 'flower',
                      value: 1,
                    }, */
                    /* {
                      name: 'vine',
                      value: 1,
                    }, */
                  ];
                  const vegetationChunkAllTypes = _normalizeChunkTypes(vegetationChunkTypes);
                  const vegetationChunkLeafTypes = _normalizeChunkTypes(vegetationChunkTypes.filter(type => type.name !== 'trunk'));
                  const trunkChunkTypes = [ 'branch', 'stem', 'wood' ].map(name => ({
                    name,
                    value: 1,
                  }));
                  const trunkChunkAllTypes = _normalizeChunkTypes(trunkChunkTypes);

                  // XXX abstract these into geometryUtils
                  const _makeGeometryFrom2dTriangles = triangles => {
                    const numTriangles = triangles.length;
                    const positions = (() => {
                      const result = new Float32Array(numTriangles * 3 * 3 * 2);
                      for (let i = 0; i < numTriangles; i++) {
                        const triangle = triangles[i];
                        const pa = triangle[0];
                        const pb = triangle[1];
                        const pc = triangle[2];

                        result[(i * 18) + 0] = pa[0];
                        result[(i * 18) + 1] = pa[1];
                        result[(i * 18) + 2] = 0;

                        result[(i * 18) + 3] = pb[0];
                        result[(i * 18) + 4] = pb[1];
                        result[(i * 18) + 5] = 0;

                        result[(i * 18) + 6] = pc[0];
                        result[(i * 18) + 7] = pc[1];
                        result[(i * 18) + 8] = 0;

                        result[(i * 18) + 9] = pc[0];
                        result[(i * 18) + 10] = pc[1];
                        result[(i * 18) + 11] = 0;

                        result[(i * 18) + 12] = pb[0];
                        result[(i * 18) + 13] = pb[1];
                        result[(i * 18) + 14] = 0;

                        result[(i * 18) + 15] = pa[0];
                        result[(i * 18) + 16] = pa[1];
                        result[(i * 18) + 17] = 0;
                      }
                      return result;
                    })();

                    const geometry = new THREE.BufferGeometry();
                    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                    geometry.computeVertexNormals();

                    return geometry;
                  };
                  const _orthogonalizeGeometry = geometry => {
                    const result = new THREE.BufferGeometry();

                    const rotatedGeometry = geometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI / 2));

                    const geometryPositions = geometry.getAttribute('position').array;
                    const rotatedGeometryPositions = rotatedGeometry.getAttribute('position').array;
                    const positions = new Float32Array(geometryPositions.length + rotatedGeometryPositions.length);
                    positions.set(geometryPositions, 0);
                    positions.set(rotatedGeometryPositions, geometryPositions.length);
                    result.addAttribute('position', new THREE.BufferAttribute(positions, 3));

                    const geometryNormals = geometry.getAttribute('normal').array;
                    const rotatedGeometryNormals = rotatedGeometry.getAttribute('normal').array;
                    const normals = new Float32Array(geometryNormals.length + rotatedGeometryNormals.length);
                    normals.set(geometryNormals, 0);
                    normals.set(rotatedGeometryNormals, geometryNormals.length);
                    result.addAttribute('normal', new THREE.BufferAttribute(normals, 3));

                    const geometryColorsAttribute = geometry.getAttribute('color');
                    const geometryColors = geometryColorsAttribute && geometryColorsAttribute.array;
                    const rotatedGeometryColorsBuffer = rotatedGeometry.getAttribute('color');
                    const rotatedGeometryColors = rotatedGeometryColorsBuffer && rotatedGeometryColorsBuffer.array;
                    if (geometryColors && rotatedGeometryColors) {
                      const colors = new Float32Array(geometryColors.length + rotatedGeometryColors.length);
                      colors.set(geometryColors, 0);
                      colors.set(rotatedGeometryColors, geometryColors.length);
                      result.addAttribute('color', new THREE.BufferAttribute(colors, 3));
                    }

                    return result;
                  };

                  const treeRng = new Alea('');

                  const mesh = (() => {
                    // cap, vine, fruit
                    const object = new THREE.Object3D();

                    const numTrees = 30;
                    for (let i = 0; i < numTrees; i++) {
                      const x = -10 + treeRng() * 20;
                      const z = -10 + treeRng() * 20;
                      if (x >= -1 && x <= 1 && z >= -1 && z <= 1) {
                        i--;
                        continue;
                      }

                      const vegetationMesh = (() => {
                        const geometry = (() => {
                          const result = new THREE.BufferGeometry();

                          const trunkColorStyle = trunkColors[Math.floor(treeRng() * trunkColors.length)];
                          const trunkColorArray = new THREE.Color(trunkColorStyle).toArray().map(c => c * 0.75);
                          const trunkGeometry = (() => {
                            const trunkNoiseValue = treeRng();
                            const type = _getChunkType(trunkNoiseValue, trunkChunkAllTypes);
                            if (type === 'branch') {
                              const height = 1;
                              const width = 0.05 + (treeRng() * 0.1);
                              const countFactor = 1;
                              const rotationFactor = 0.15;

                              const boxGeometry = new THREE.BoxGeometry(width, height, width);
                              const {vertices} = boxGeometry;
                              for (let i = 0; i < vertices.length; i++) {
                                const vertex = vertices[i];
                                vertex.x += (-width / 2) + (treeRng() * (width / 2));
                                vertex.y += height / 2;
                                vertex.z += (-width / 2) + (treeRng() * (width / 2));
                              }

                              const geometry = new THREE.BufferGeometry().fromGeometry(boxGeometry);
                              geometry.height = height;
                              geometry.width = width;
                              geometry.countFactor = countFactor;
                              geometry.rotationFactor = rotationFactor;

                              return geometry;
                            } else if (type === 'stem') {
                              const height = 1;
                              const width = 0.05 + (treeRng() * 0.1);
                              const countFactor = 1;
                              const rotationFactor = 0.15;

                              const frontGeometry = (() => {
                                const numPoints = 4 + Math.floor(treeRng() * (4 + 1));
                                const triangles = [];
                                const nodeSideOffset = (0.3 + (treeRng() * 0.7)) * (width * 0.5);
                                let lastLeftPoint = [ -nodeSideOffset, 0 ];
                                let lastRightPoint = [ nodeSideOffset, 0 ];
                                for (let i = 1; i < numPoints; i++) {
                                  const sideOffset = (() => {
                                    if (i !== (numPoints - 1)) {
                                      return (0.3 + (treeRng() * 0.7)) * width;
                                    } else {
                                      return nodeSideOffset;
                                    }
                                  })();
                                  const leftPoint = [-sideOffset, (i / (numPoints - 1)) * height];
                                  const rightPoint = [sideOffset, (i / (numPoints - 1)) * height];

                                  triangles.push([
                                    lastLeftPoint,
                                    lastRightPoint,
                                    leftPoint,
                                  ], [
                                    leftPoint,
                                    rightPoint,
                                    lastRightPoint,
                                  ]);

                                  lastLeftPoint = leftPoint;
                                  lastRightPoint = rightPoint;
                                }

                                return _makeGeometryFrom2dTriangles(triangles);
                              })();

                              const geometry = _orthogonalizeGeometry(frontGeometry);
                              geometry.height = height;
                              geometry.width = width;
                              geometry.countFactor = countFactor;
                              geometry.rotationFactor = rotationFactor;

                              return geometry;
                            } else if (type === 'wood') {
                              const height = 1;
                              const width = 0.1 + (treeRng() * 0.1);
                              const countFactor = 4;
                              const rotationFactor = 0.15;

                              const boxGeometry = new THREE.BoxGeometry(width, height, width);
                              const {vertices} = boxGeometry;
                              for (let i = 0; i < vertices.length; i++) {
                                const vertex = vertices[i];
                                vertex.x += (-width / 2) + (treeRng() * (width / 2));
                                vertex.y += height / 2;
                                vertex.z += (-width / 2) + (treeRng() * (width / 2));
                              }

                              const geometry = new THREE.BufferGeometry().fromGeometry(boxGeometry);
                              geometry.height = height;
                              geometry.width = width;
                              geometry.countFactor = countFactor;
                              geometry.rotationFactor = rotationFactor;

                              return geometry;
                            } else {
                              return null; // can't happen
                            }
                          })();

                          const leafGeometry = (() => {
                            const height = 1;
                            const width = 0.15 + (treeRng() * 0.1);
                            const minRotationFactor = 0.25;
                            const maxRotationFactor = 0.75;
                            const frontGeometry = (() => {
                              const numPoints = 4 + Math.floor(treeRng() * (4 + 1));
                              const triangles = [];
                              let lastLeftPoint = [ 0, 0 ];
                              let lastRightPoint = lastLeftPoint;
                              for (let i = 1; i < numPoints; i++) {
                                const sideOffset = (() => {
                                  if (i !== (numPoints - 1)) {
                                    return (0.3 + (treeRng() * 0.7)) * width;
                                  } else {
                                    return 0;
                                  }
                                })();
                                const leftPoint = [-sideOffset, (i / (numPoints - 1)) * height];
                                const rightPoint = [sideOffset, (i / (numPoints - 1)) * height];

                                triangles.push([
                                  lastLeftPoint,
                                  lastRightPoint,
                                  leftPoint,
                                ], [
                                  leftPoint,
                                  rightPoint,
                                  lastRightPoint,
                                ]);

                                lastLeftPoint = leftPoint;
                                lastRightPoint = rightPoint;
                              }

                              return _makeGeometryFrom2dTriangles(triangles);
                            })();

                            const geometry = _orthogonalizeGeometry(frontGeometry);
                            geometry.height = height;
                            geometry.width = width;
                            geometry.minRotationFactor = minRotationFactor;
                            geometry.maxRotationFactor = maxRotationFactor;

                            return geometry;
                          })();

                          // geometry construction
                          const positionsBuffers = [];
                          const normalsBuffers = [];
                          const colorsBuffers = [];

                          const trunkRotation = [
                            (-trunkGeometry.rotationFactor + (treeRng() * trunkGeometry.rotationFactor * 2)) * (Math.PI * 2),
                            (-trunkGeometry.rotationFactor + (treeRng() * trunkGeometry.rotationFactor * 2)) * (Math.PI * 2),
                          ];
                          const trunkCountFactor = trunkGeometry.countFactor;
                          const leafRotation = (leafGeometry.minRotationFactor + (treeRng() * (leafGeometry.maxRotationFactor - leafGeometry.minRotationFactor))) * Math.PI;

                          const maxTrunkDepth = Math.floor((1 + Math.floor(treeRng() * (4 + 1))) * trunkCountFactor);
                          const recurse = (position = new THREE.Vector3(0, 0, 0), rotationDepth = 0, rotationOffset = 0, trunkDepth = 0) => {
                            const type = (() => {
                              if (trunkDepth === 0) {
                                return 'base';
                              } else {
                                const typeNoiseValue = treeRng();
                                const typeCandidates = (trunkDepth < maxTrunkDepth) ? vegetationChunkAllTypes : vegetationChunkLeafTypes;
                                return _getChunkType(typeNoiseValue, typeCandidates);
                              }
                            })();
                            const _pushColors = (numPositions, colorArray) => {
                              const colorBuffer = new Float32Array(numPositions);
                              for (let k = 0; k < numPositions; k += 3) {
                                colorBuffer[k + 0] = colorArray[0];
                                colorBuffer[k + 1] = colorArray[1];
                                colorBuffer[k + 2] = colorArray[2];
                              }
                              colorsBuffers.push(colorBuffer);
                            };
                            if (type === 'base') {
                              const trunkGeometryClone = trunkGeometry.clone();
                              const trunkHeightScale = (0.5 + (treeRng() * 1.5)) / trunkCountFactor;
                              trunkGeometryClone.applyMatrix(new THREE.Matrix4().makeScale(1, trunkHeightScale, 1));

                              const trunkClonePositionsBuffer = trunkGeometryClone.getAttribute('position').array;
                              positionsBuffers.push(trunkClonePositionsBuffer);
                              const trunkCloneNormalsBuffer = trunkGeometryClone.getAttribute('normal').array;
                              normalsBuffers.push(trunkCloneNormalsBuffer);
                              _pushColors(trunkClonePositionsBuffer.length, trunkColorArray);

                              const nextPosition = position.clone()
                                .add(new THREE.Vector3(0, trunkGeometry.height * trunkHeightScale, 0));
                              recurse(nextPosition, rotationDepth + 1, rotationOffset, trunkDepth + 1);
                            } else if (type === 'trunk') {
                              const numTrunks = (() => {
                                const value = treeRng() * trunkCountFactor;
                                if (value < 0.2) {
                                  return 3;
                                } else if (value < 0.5) {
                                  return 2;
                                } else {
                                  return 1;
                                }
                              })();
                              const trunkHeightScale = (0.5 + (treeRng() * 1.5)) / trunkCountFactor;
                              for (let i = 0; i < numTrunks; i++) {
                                const trunkGeometryClone = trunkGeometry.clone();
                                trunkGeometryClone.applyMatrix(new THREE.Matrix4().makeScale(1, trunkHeightScale, 1));

                                const rotationOrthogonalVector = new THREE.Vector3(1, 0, 0);
                                const rotationOrthogonalVector2 = new THREE.Vector3(0, 0, 1);

                                if (numTrunks === 1) {
                                  trunkGeometryClone.applyMatrix(new THREE.Matrix4().makeRotationAxis(rotationOrthogonalVector, trunkRotation[0] * (rotationDepth / trunkCountFactor)));
                                  trunkGeometryClone.applyMatrix(new THREE.Matrix4().makeRotationAxis(rotationOrthogonalVector2, trunkRotation[1] * (rotationDepth / trunkCountFactor)));

                                  trunkGeometryClone.applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z));

                                  const trunkClonePositionsBuffer = trunkGeometryClone.getAttribute('position').array;
                                  positionsBuffers.push(trunkClonePositionsBuffer);
                                  const trunkCloneNormalsBuffer = trunkGeometryClone.getAttribute('normal').array;
                                  normalsBuffers.push(trunkCloneNormalsBuffer);
                                  _pushColors(trunkClonePositionsBuffer.length, trunkColorArray);

                                  const nextPosition = position.clone()
                                    .add(new THREE.Vector3(0, trunkGeometry.height * trunkHeightScale, 0)
                                      .applyAxisAngle(rotationOrthogonalVector, trunkRotation[0] * (rotationDepth / trunkCountFactor))
                                      .applyAxisAngle(rotationOrthogonalVector2, trunkRotation[1] * (rotationDepth / trunkCountFactor))
                                    );
                                  recurse(nextPosition, rotationDepth + 1, rotationOffset, trunkDepth + 1);
                                } else {
                                  trunkGeometryClone.applyMatrix(new THREE.Matrix4().makeRotationAxis(rotationOrthogonalVector, trunkRotation[0] * (rotationDepth / trunkCountFactor)));
                                  trunkGeometryClone.applyMatrix(new THREE.Matrix4().makeRotationAxis(rotationOrthogonalVector2, trunkRotation[1] * (rotationDepth / trunkCountFactor)));

                                  const upVector = new THREE.Vector3(0, 1, 0);
                                  rotationOffset += (i / numTrunks) * (Math.PI * 2);
                                  trunkGeometryClone.applyMatrix(new THREE.Matrix4().makeRotationAxis(upVector, rotationOffset / trunkCountFactor));

                                  trunkGeometryClone.applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z));

                                  const trunkClonePositionsBuffer = trunkGeometryClone.getAttribute('position').array;
                                  positionsBuffers.push(trunkClonePositionsBuffer);
                                  const trunkCloneNormalsBuffer = trunkGeometryClone.getAttribute('normal').array;
                                  normalsBuffers.push(trunkCloneNormalsBuffer);
                                  _pushColors(trunkClonePositionsBuffer.length, trunkColorArray);

                                  const nextPosition = position.clone()
                                    .add(new THREE.Vector3(0, trunkGeometry.height * trunkHeightScale, 0)
                                      .applyAxisAngle(rotationOrthogonalVector, trunkRotation[0] * (rotationDepth / trunkCountFactor))
                                      .applyAxisAngle(rotationOrthogonalVector2, trunkRotation[1] * (rotationDepth / trunkCountFactor))
                                      .applyAxisAngle(upVector, rotationOffset / trunkCountFactor)
                                    );
                                  recurse(nextPosition, rotationDepth + 1, rotationOffset, trunkDepth + 1);
                                }
                              }
                            } else if (type === 'leaf') {
                              const numCanopies = 1 + Math.floor(treeRng() * (3 + 1));
                              const leafScale = 1 + (treeRng() * 2);
                              for (let i = 0; i < numCanopies; i++) {
                                const leafGeometryClone = leafGeometry.clone();
                                leafGeometryClone.applyMatrix(new THREE.Matrix4().makeScale(leafScale, leafScale, leafScale));

                                if (numCanopies === 1) {
                                  // nothing
                                } else {
                                  const rightVector = new THREE.Vector3(1, 0, 0);
                                  leafGeometryClone.applyMatrix(new THREE.Matrix4().makeRotationAxis(rightVector, leafRotation));
                                  const upVector = new THREE.Vector3(0, 1, 0);
                                  leafGeometryClone.applyMatrix(new THREE.Matrix4().makeRotationAxis(upVector, (i / numCanopies) * (Math.PI * 2)));
                                }
                                leafGeometryClone.applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z));

                                const leafClonePositionsBuffer = leafGeometryClone.getAttribute('position').array;
                                positionsBuffers.push(leafClonePositionsBuffer);
                                const leafCloneNormalsBuffer = leafGeometryClone.getAttribute('normal').array;
                                normalsBuffers.push(leafCloneNormalsBuffer);
                                _pushColors(leafClonePositionsBuffer.length, trunkColorArray);
                              }
                            } else if (type === 'fruit') {
                              // XXX
                            } else if (type === 'flower') {
                              // XXX
                            } else if (type === 'vine') {
                              // XXX
                            } else {
                              // nothing
                            }
                          };
                          recurse();

                          const _collapseBuffers = buffers => {
                            const totalBuffersSize = (() => {
                              let result = 0;
                              for (let i = 0; i < buffers.length; i++) {
                                const buffer = buffers[i];
                                result += buffer.length;
                              }
                              return result;
                            })();
                            const result = new Float32Array(totalBuffersSize);
                            let byteOffset = 0;
                            for (let i = 0; i < buffers.length; i++) {
                              const buffer = buffers[i];
                              result.set(buffer, byteOffset);
                              byteOffset += buffer.length;
                            }
                            return result;
                          };

                          result.addAttribute('position', new THREE.BufferAttribute(_collapseBuffers(positionsBuffers), 3));
                          result.addAttribute('normal', new THREE.BufferAttribute(_collapseBuffers(normalsBuffers), 3));
                          result.addAttribute('color', new THREE.BufferAttribute(_collapseBuffers(colorsBuffers), 3));

                          return result;
                        })();
                        const material = treeMaterial;

                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.position.x = x;
                        mesh.position.y = 0;
                        mesh.position.z = z;
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;

                        return mesh;
                      })();
                      object.add(vegetationMesh);
                    }

                    return object;
                  })();
                  scene.add(mesh);

                  this._cleanup = () => {
                    scene.remove(mesh);
                  };
                }

                destructor() {
                  this._cleanup();
                }
              },
              class GrassElement extends HTMLElement {
                static get tag() {
                  return 'vegetation.grass';
                }
                static get attributes() {
                  return {
                    position: {
                      type: 'matrix',
                      value: [
                        0, 0, 0,
                        0, 0, 0, 1,
                        1, 1, 1,
                      ],
                    },
                  };
                }

                createdCallback() {
                  const grassColors = [
                    '#337346',
                    '#0e6525',
                    '#8eb264',
                    '#547a18',
                    '#136659',
                    '#596652',
                    '#32554a',
                    '#bdb164',

                    '#225e34',
                    '#24541f',
                    '#b6da8c',
                    '#2d410b',
                    '#173933',
                    '#454f3f',
                    '#5a7d72',
                    '#a79c67',
                  ];

                  const grassMaterial = new THREE.MeshLambertMaterial({
                    color: 0xFFFFFF,
                    // emissive: 0x333333,
                    // specular: 0x000000,
                    // shininess: 0,
                    // side: THREE.DoubleSide,
                    shading: THREE.FlatShading,
                    vertexColors: THREE.VertexColors,
                  });

                  // XXX abstract these into sampleUtils
                  const _normalizeChunkTypes = types => {
                    const totalTypesValue = (() => {
                      let result = 0;
                      for (let i = 0; i < types.length; i++) {
                        const type = types[i];
                        const {value} = type;
                        result += value;
                      }
                      return result;
                    })();

                    let acc = 0;
                    return types.map((type, i, a) => {
                      const {name} = type;
                      const threshold = (() => {
                        if (i !== (a - 1)) {
                          const {value} = type;
                          acc += value / totalTypesValue;
                          return acc;
                        } else {
                          return 1;
                        }
                      })();
                      return {
                        name,
                        threshold,
                      };
                    });
                  };
                  const _getChunkType = (noiseValue, types) => {
                    for (let i = 0; i < types.length; i++) {
                      const type = types[i];
                      const {name, threshold} = type;
                      if (noiseValue < threshold) {
                        return name;
                      }
                    }
                    return null;
                  };

                  const grassChunkTypes = [ /* 'normal', 'clipped', 'messy', 'curly', 'stringy', */ 'bulby', /* 'leafy', /* 'ferny', 'mushroomy', 'seaweed', 'tuft', 'combed', 'tall' */ ].map(name => ({
                    name,
                    value: 1,
                  }));
                  const grassChunkAllTypes = _normalizeChunkTypes(grassChunkTypes);

                  // XXX abstract these into geometryUtils
                  const _cropizeGeometry = geometry => {
                    const result = new THREE.BufferGeometry();

                    const northGeometry = geometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.25));
                    const eastGeometry = northGeometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI / 2));

                    const southGeometry = eastGeometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI / 2));
                    const westGeometry = southGeometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI / 2));

                    const northGeometryPositions = northGeometry.getAttribute('position').array;
                    const eastGeometryPositions = eastGeometry.getAttribute('position').array;
                    const southGeometryPositions = southGeometry.getAttribute('position').array;
                    const westGeometryPositions = westGeometry.getAttribute('position').array;
                    const positions = new Float32Array(northGeometryPositions.length + eastGeometryPositions.length + southGeometryPositions.length + westGeometryPositions.length);
                    positions.set(northGeometryPositions, 0);
                    positions.set(eastGeometryPositions, northGeometryPositions.length);
                    positions.set(southGeometryPositions, northGeometryPositions.length + eastGeometryPositions.length);
                    positions.set(westGeometryPositions, northGeometryPositions.length + eastGeometryPositions.length + southGeometryPositions.length);
                    result.addAttribute('position', new THREE.BufferAttribute(positions, 3));

                    const northGeometryNormals = northGeometry.getAttribute('normal').array;
                    const eastGeometryNormals = eastGeometry.getAttribute('normal').array;
                    const southGeometryNormals = southGeometry.getAttribute('normal').array;
                    const westGeometryNormals = westGeometry.getAttribute('normal').array;
                    const normals = new Float32Array(northGeometryNormals.length + eastGeometryNormals.length + southGeometryNormals.length + westGeometryNormals.length);
                    normals.set(northGeometryPositions, 0);
                    normals.set(eastGeometryNormals, northGeometryNormals.length);
                    normals.set(southGeometryNormals, northGeometryNormals.length + eastGeometryNormals.length);
                    normals.set(westGeometryNormals, northGeometryNormals.length + eastGeometryNormals.length + southGeometryNormals.length);
                    result.addAttribute('normal', new THREE.BufferAttribute(normals, 3));

                    const northGeometryColorsAttribute = northGeometry.getAttribute('color');
                    const northGeometryColors = northGeometryColorsAttribute && northGeometryColorsAttribute.array;
                    const eastGeometryColorsAttribute = eastGeometry.getAttribute('color');
                    const eastGeometryColors = eastGeometryColorsAttribute && eastGeometryColorsAttribute.array;
                    const southGeometryColorsAttribute = southGeometry.getAttribute('color');
                    const southGeometryColors = southGeometryColorsAttribute && southGeometryColorsAttribute.array;
                    const westGeometryColorsAttribute = westGeometry.getAttribute('color');
                    const westGeometryColors = westGeometryColorsAttribute && westGeometryColorsAttribute.array;
                    if (northGeometryColors && eastGeometryColors && southGeometryColors && westGeometryColors) {
                      const colors = new Float32Array(northGeometryColors.length + eastGeometryColors.length + southGeometryColors.length + westGeometryColors.length);
                      colors.set(northGeometryColors, 0);
                      colors.set(eastGeometryColors, northGeometryColors.length);
                      colors.set(southGeometryColors, northGeometryColors.length + eastGeometryColors.length);
                      colors.set(westGeometryColors, northGeometryColors.length + eastGeometryColors.length + southGeometryColors.length);
                      result.addAttribute('color', new THREE.BufferAttribute(colors, 3));
                    }

                    return result;
                  };

                  const grassRng = new Alea('');

                  const mesh = (() => {
                    const mesh = new THREE.Object3D();

                    const numGrasses = 100;
                    for (let i = 0; i < numGrasses; i++) {
                      const x = -10 + grassRng() * 20;
                      const z = -10 + grassRng() * 20;
                      if (x >= -1 && x <= 1 && z >= -1 && z <= 1) {
                        i--;
                        continue;
                      }

                      const grass = (() => {
                        const grassColorStyle = grassColors[Math.floor(grassRng() * grassColors.length)];
                        const grassColorArray = new THREE.Color(grassColorStyle).toArray().map(c => c * 0.75);

                        const geometry = (() => {
                          const _makeColors = numTriangles => {
                            const result = new Float32Array(numTriangles * 3);
                            for (let i = 0; i < numTriangles; i++) {
                              result[(i * 3) + 0] = grassColorArray[0];
                              result[(i * 3) + 1] = grassColorArray[1];
                              result[(i * 3) + 2] = grassColorArray[2];
                            }
                            return result;
                          };
                          const _makeTrianglePusher = result => {
                            let triangleIndex = 0;
                            return (pa, pb, pc) => {
                              // front
                              result[(triangleIndex * 18) + 0] = pa[0];
                              result[(triangleIndex * 18) + 1] = pa[1];
                              result[(triangleIndex * 18) + 2] = pa[2];

                              result[(triangleIndex * 18) + 3] = pb[0];
                              result[(triangleIndex * 18) + 4] = pb[1];
                              result[(triangleIndex * 18) + 5] = pb[2];

                              result[(triangleIndex * 18) + 6] = pc[0];
                              result[(triangleIndex * 18) + 7] = pc[1];
                              result[(triangleIndex * 18) + 8] = pc[2];

                              // back
                              result[(triangleIndex * 18) + 9] = pc[0];
                              result[(triangleIndex * 18) + 10] = pc[1];
                              result[(triangleIndex * 18) + 11] = pc[2];

                              result[(triangleIndex * 18) + 12] = pb[0];
                              result[(triangleIndex * 18) + 13] = pb[1];
                              result[(triangleIndex * 18) + 14] = pb[2];

                              result[(triangleIndex * 18) + 15] = pa[0];
                              result[(triangleIndex * 18) + 16] = pa[1];
                              result[(triangleIndex * 18) + 17] = pa[2];

                              triangleIndex++;
                            };
                          };
                          const _makeQuadFacePusher = result => {
                            let faceIndex = 0;
                            return (pa, pb, pc, pd) => {
                              // abc
                              // front
                              result[(faceIndex * 36) + 0] = pa[0];
                              result[(faceIndex * 36) + 1] = pa[1];
                              result[(faceIndex * 36) + 2] = pa[2];

                              result[(faceIndex * 36) + 3] = pb[0];
                              result[(faceIndex * 36) + 4] = pb[1];
                              result[(faceIndex * 36) + 5] = pb[2];

                              result[(faceIndex * 36) + 6] = pc[0];
                              result[(faceIndex * 36) + 7] = pc[1];
                              result[(faceIndex * 36) + 8] = pc[2];

                              // back
                              result[(faceIndex * 36) + 9] = pc[0];
                              result[(faceIndex * 36) + 10] = pc[1];
                              result[(faceIndex * 36) + 11] = pc[2];

                              result[(faceIndex * 36) + 12] = pb[0];
                              result[(faceIndex * 36) + 13] = pb[1];
                              result[(faceIndex * 36) + 14] = pb[2];

                              result[(faceIndex * 36) + 15] = pa[0];
                              result[(faceIndex * 36) + 16] = pa[1];
                              result[(faceIndex * 36) + 17] = pa[2];

                              // acd
                              // front
                              result[(faceIndex * 36) + 18] = pa[0];
                              result[(faceIndex * 36) + 19] = pa[1];
                              result[(faceIndex * 36) + 20] = pa[2];

                              result[(faceIndex * 36) + 21] = pc[0];
                              result[(faceIndex * 36) + 22] = pc[1];
                              result[(faceIndex * 36) + 23] = pc[2];

                              result[(faceIndex * 36) + 24] = pd[0];
                              result[(faceIndex * 36) + 25] = pd[1];
                              result[(faceIndex * 36) + 26] = pd[2];

                              // back
                              result[(faceIndex * 36) + 27] = pd[0];
                              result[(faceIndex * 36) + 28] = pd[1];
                              result[(faceIndex * 36) + 29] = pd[2];

                              result[(faceIndex * 36) + 30] = pc[0];
                              result[(faceIndex * 36) + 31] = pc[1];
                              result[(faceIndex * 36) + 32] = pc[2];

                              result[(faceIndex * 36) + 33] = pa[0];
                              result[(faceIndex * 36) + 34] = pa[1];
                              result[(faceIndex * 36) + 35] = pa[2];

                              faceIndex++;
                            };
                          };

                          const typeNoiseValue = grassRng();
                          const type = _getChunkType(typeNoiseValue, grassChunkAllTypes);
                          let positions = null;
                          let colors = null;
                          if (type === 'normal') {
                            const numBlades = 16 + Math.floor(grassRng() * (16 + 1));
                            const numTriangles = numBlades * 3 * 2;
                            positions = (() => {
                              const result = new Float32Array(numTriangles * 3);

                              const _pushTriangle = _makeTrianglePusher(result);

                              const width = 0.5 + (grassRng() * 0.5);
                              const height = 0.25 + (grassRng() * 0.25);
                              const bladeWidth = (width / numBlades) * (0.5 + (grassRng() * 0.25));
                              const bladeHeight = height * (0.75 + (grassRng() * 0.25));
                              for (let i = 0; i < numBlades; i++) {
                                const zOffset = -0.025 + (grassRng() * 0.05);
                                const pa = [
                                  width * ((-0.5 + (i / (numBlades - 1)) - (bladeWidth / 2))),
                                  0,
                                  zOffset,
                                ];
                                const pb = [
                                  width * (-0.5 + (i / (numBlades - 1))),
                                  bladeHeight,
                                  zOffset,
                                ];
                                const pc = [
                                  width * (-0.5 + (i / (numBlades - 1)) + (bladeWidth / 2)),
                                  0,
                                  zOffset,
                                ];

                                _pushTriangle(pa, pb, pc);
                              }

                              return result;
                            })();
                            colors = _makeColors(numTriangles);
                          } else if (type === 'clipped') {
                            const numBlades = 16 + Math.floor(grassRng() * (16 + 1));
                            const numTriangles = numBlades * 3 * 2 * 2;
                            positions = (() => {
                              const result = new Float32Array(numTriangles * 3);

                              const _pushQuadFace = _makeQuadFacePusher(result);

                              const width = 0.5 + (grassRng() * 0.5);
                              const height = 0.2 + (grassRng() * 0.2);
                              for (let i = 0; i < numBlades; i++) {
                                const bladeWidth = (width / numBlades) * (0.5 + (grassRng() * 0.25));
                                const bladeHeight = height * (0.75 + (grassRng() * 0.25));
                                const zOffset = -0.025 + (grassRng() * 0.05);
                                const pa = [
                                  width * ((-0.5 + (i / (numBlades - 1)) - (bladeWidth / 2))),
                                  0,
                                  zOffset,
                                ];
                                const pb = [
                                  width * ((-0.5 + (i / (numBlades - 1)) - (bladeWidth / 2))),
                                  bladeHeight,
                                  zOffset,
                                ];
                                const pc = [
                                  width * (-0.5 + (i / (numBlades - 1)) + (bladeWidth / 2)),
                                  bladeHeight,
                                  zOffset,
                                ];
                                const pd = [
                                  width * (-0.5 + (i / (numBlades - 1)) + (bladeWidth / 2)),
                                  0,
                                  zOffset,
                                ];

                                _pushQuadFace(pa, pb, pc, pd);
                              }

                              return result;
                            })();
                            colors = _makeColors(numTriangles);
                          } else if (type === 'messy') {
                            const numBlades = 16 + Math.floor(grassRng() * (16 + 1));
                            const bladePartsSpec = (() => {
                              const result = Array(numBlades);
                              for (let i = 0; i < numBlades; i++) {
                                result[i] = 2 + Math.floor(grassRng() * (6 + 1));
                              }
                              return result;
                            })();
                            const totalNumBladeParts = funUtils.sum(bladePartsSpec);
                            const numTriangles = totalNumBladeParts * 3 * 2 * 2;
                            positions = (() => {
                              const result = new Float32Array(numTriangles * 3);

                              const _pushQuadFace = _makeQuadFacePusher(result);

                              const width = 0.5 + (grassRng() * 0.5);
                              const height = 0.25 + (grassRng() * 0.25);
                              for (let i = 0; i < numBlades; i++) {
                                const numBladeParts = bladePartsSpec[i];
                                const bladeWidth = (width / numBlades) * (0.5 + (grassRng() * 0.25));
                                const bladeHeight = height * (0.75 + (grassRng() * 0.25));
                                const zOffset = -0.025 + (grassRng() * 0.05);
                                const bladeMessiness = 0.5 + (grassRng() * 1.5);

                                const _getBladePartWidth = i => bladeWidth * (1 - (i / numBladeParts));
                                const _getBladePartXOffset = () => bladeWidth * (-(bladeMessiness / 2) + (grassRng() * bladeMessiness));
                                const _getBladePartYOffset = i => bladeHeight * (i / numBladeParts);

                                let lastBladePartXOffset = _getBladePartXOffset();
                                for (let j = 0; j < numBladeParts; j++) {
                                  const bottomBladePartWidth = _getBladePartWidth(j);
                                  const bottomBladePartXOffset = lastBladePartXOffset;
                                  const bottomBladePartYOffset = _getBladePartYOffset(j);
                                  const topBladePartWidth = _getBladePartWidth(j + 1);
                                  const topBladePartXOffset = _getBladePartXOffset();
                                  const topBladePartYOffset = _getBladePartYOffset(j + 1);

                                  const pa = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) - (bottomBladePartWidth / 2) + bottomBladePartXOffset,
                                    bottomBladePartYOffset,
                                    zOffset,
                                  ];
                                  const pb = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) - (topBladePartWidth / 2) + topBladePartXOffset,
                                    topBladePartYOffset,
                                    zOffset,
                                  ];
                                  const pc = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) + (topBladePartWidth / 2) + topBladePartXOffset,
                                    topBladePartYOffset,
                                    zOffset,
                                  ];
                                  const pd = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) + (bottomBladePartWidth / 2) + bottomBladePartXOffset,
                                    bottomBladePartYOffset,
                                    zOffset,
                                  ];

                                  _pushQuadFace(pa, pb, pc, pd);

                                  lastBladePartXOffset = topBladePartXOffset;
                                }
                              }

                              return result;
                            })();
                            colors = _makeColors(numTriangles);
                          } else if (type === 'curly') {
                            const numBlades = 4 + Math.floor(grassRng() * (4 + 1));
                            const bladePartsSpec = (() => {
                              const result = Array(numBlades);
                              for (let i = 0; i < numBlades; i++) {
                                result[i] = 2 + Math.floor(grassRng() * (6 + 1));
                              }
                              return result;
                            })();
                            const totalNumBladeParts = funUtils.sum(bladePartsSpec);
                            const numTriangles = totalNumBladeParts * 3 * 2 * 2;
                            positions = (() => {
                              const result = new Float32Array(numTriangles * 3);

                              const _pushQuadFace = _makeQuadFacePusher(result);

                              const width = 0.5 + (grassRng() * 0.5);
                              const height = 0.5 + (grassRng() * 0.5);
                              for (let i = 0; i < numBlades; i++) {
                                const numBladeParts = bladePartsSpec[i];
                                const bladeWidth = (width / numBlades) * (0.5 + (grassRng() * 0.25));
                                const bladeHeight = height * (0.25 + (grassRng() * 0.55));
                                const zOffset = -0.025 + (grassRng() * 0.05);
                                const bladeDirection = (grassRng() < 0.5) ? 'left' : 'right';
                                const bladeCurliness = (0.05 + (grassRng() * 0.05)) * (bladeDirection === 'left' ? -1 : 1);

                                const _getBladePartWidth = i => bladeWidth * (1 - (i / numBladeParts));

                                let lastBladePartXOffset = 0;
                                let lastBladePartYOffset = 0;
                                for (let j = 0; j < numBladeParts; j++) {
                                  const bottomBladePartWidth = _getBladePartWidth(j);
                                  const bottomBladePartXOffset = lastBladePartXOffset;
                                  const bottomBladePartYOffset = lastBladePartYOffset;
                                  const {bottomBladePartSideXOffset, bottomBladePartSideYOffset} = (() => {
                                    const rightVector = new THREE.Vector3(bottomBladePartWidth / 2, 0, 0);
                                    const orthogonalRightVector = new THREE.Vector3(0, 0, -1);
                                    const rotatedRightVector = rightVector.clone()
                                      .applyAxisAngle(orthogonalRightVector, bladeCurliness * j * (Math.PI * 2));

                                    return {
                                      bottomBladePartSideXOffset: rotatedRightVector.x,
                                      bottomBladePartSideYOffset: rotatedRightVector.y,
                                    };
                                  })();

                                  const topBladePartWidth = _getBladePartWidth(j + 1);
                                  const {topBladePartXOffset, topBladePartYOffset} = (() => {
                                    const upVector = new THREE.Vector3(0, 1 / numBladeParts, 0);
                                    const orthogonalUpVector = new THREE.Vector3(0, 0, -1);
                                    const rotatedUpVector = upVector.clone()
                                      .applyAxisAngle(orthogonalUpVector, bladeCurliness * (j + 1) * (Math.PI * 2));

                                    return {
                                      topBladePartXOffset: bottomBladePartXOffset + rotatedUpVector.x,
                                      topBladePartYOffset: bottomBladePartYOffset + rotatedUpVector.y,
                                    };
                                  })();

                                  const {topBladePartSideXOffset, topBladePartSideYOffset} = (() => {
                                    const rightVector = new THREE.Vector3(topBladePartWidth / 2, 0, 0);
                                    const orthogonalRightVector = new THREE.Vector3(0, 0, -1);
                                    const rotatedRightVector = rightVector.clone()
                                      .applyAxisAngle(orthogonalRightVector, bladeCurliness * (j + 1) * (Math.PI * 2));

                                    return {
                                      topBladePartSideXOffset: rotatedRightVector.x,
                                      topBladePartSideYOffset: rotatedRightVector.y,
                                    };
                                  })();

                                  const pa = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) + bottomBladePartXOffset - bottomBladePartSideXOffset,
                                    bottomBladePartYOffset - bottomBladePartSideYOffset,
                                    zOffset,
                                  ];
                                  const pb = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) + topBladePartXOffset - topBladePartSideXOffset,
                                    topBladePartYOffset - topBladePartSideYOffset,
                                    zOffset,
                                  ];
                                  const pc = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) + topBladePartXOffset + topBladePartSideXOffset,
                                    topBladePartYOffset + topBladePartSideYOffset,
                                    zOffset,
                                  ];
                                  const pd = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) + bottomBladePartXOffset + bottomBladePartSideXOffset,
                                    bottomBladePartYOffset + bottomBladePartSideYOffset,
                                    zOffset,
                                  ];

                                  _pushQuadFace(pa, pb, pc, pd);

                                  lastBladePartXOffset = topBladePartXOffset;
                                  lastBladePartYOffset = topBladePartYOffset;
                                }
                              }

                              return result;
                            })();
                            colors = _makeColors(numTriangles);
                          } else if (type === 'stringy') {
                            const numBlades = 5 + Math.floor(grassRng() * (5 + 1));
                            const bladePartsSpec = (() => {
                              const result = Array(numBlades);
                              for (let i = 0; i < numBlades; i++) {
                                result[i] = 6 + Math.floor(grassRng() * (10 + 1));
                              }
                              return result;
                            })();
                            const totalNumBladeParts = funUtils.sum(bladePartsSpec);
                            const numTriangles = totalNumBladeParts * 3 * 2 * 2;
                            positions = (() => {
                              const result = new Float32Array(numTriangles * 3);

                              const _pushQuadFace = _makeQuadFacePusher(result);

                              const width = 0.5 + (grassRng() * 0.5);
                              const height = 1;
                              for (let i = 0; i < numBlades; i++) {
                                const numBladeParts = bladePartsSpec[i];
                                const bladeWidth = (width / numBlades) * (0.25 + (grassRng() * 0.25));
                                const bladeHeight = height * (0.25 + (grassRng() * 0.75));
                                const zOffset = -0.025 + (grassRng() * 0.05);
                                const bladeDirection = (grassRng() < 0.5) ? 'left' : 'right';
                                const bladeCurliness = (grassRng() * 0.2) * (bladeDirection === 'left' ? -1 : 1);
                                const bladeCurlinessExponent = 2 + (grassRng() * 1)

                                const _getBladePartWidth = i => bladeWidth * (1 - (i / numBladeParts));

                                let lastBladePartXOffset = 0;
                                let lastBladePartYOffset = 0;
                                for (let j = 0; j < numBladeParts; j++) {
                                  const bottomBladePartWidth = _getBladePartWidth(j);
                                  const bottomBladeCurliness = bladeCurliness * Math.pow(j / numBladeParts, bladeCurlinessExponent);
                                  const bottomBladePartXOffset = lastBladePartXOffset;
                                  const bottomBladePartYOffset = lastBladePartYOffset;
                                  const {bottomBladePartSideXOffset, bottomBladePartSideYOffset} = (() => {
                                    const rightVector = new THREE.Vector3(bottomBladePartWidth / 2, 0, 0);
                                    const orthogonalRightVector = new THREE.Vector3(0, 0, -1);
                                    const rotatedRightVector = rightVector.clone()
                                      .applyAxisAngle(orthogonalRightVector, bottomBladeCurliness * j * (Math.PI * 2));

                                    return {
                                      bottomBladePartSideXOffset: rotatedRightVector.x,
                                      bottomBladePartSideYOffset: rotatedRightVector.y,
                                    };
                                  })();

                                  const topBladePartWidth = _getBladePartWidth(j + 1);
                                  const topBladeCurliness = bladeCurliness * Math.pow((j + 1) / numBladeParts, bladeCurlinessExponent);
                                  const {topBladePartXOffset, topBladePartYOffset} = (() => {
                                    const upVector = new THREE.Vector3(0, 1 / numBladeParts, 0);
                                    const orthogonalUpVector = new THREE.Vector3(0, 0, -1);
                                    const rotatedUpVector = upVector.clone()
                                      .applyAxisAngle(orthogonalUpVector, topBladeCurliness * (j + 1) * (Math.PI * 2));

                                    return {
                                      topBladePartXOffset: bottomBladePartXOffset + rotatedUpVector.x,
                                      topBladePartYOffset: bottomBladePartYOffset + rotatedUpVector.y,
                                    };
                                  })();

                                  const {topBladePartSideXOffset, topBladePartSideYOffset} = (() => {
                                    const rightVector = new THREE.Vector3(topBladePartWidth / 2, 0, 0);
                                    const orthogonalRightVector = new THREE.Vector3(0, 0, -1);
                                    const rotatedRightVector = rightVector.clone()
                                      .applyAxisAngle(orthogonalRightVector, topBladeCurliness * (j + 1) * (Math.PI * 2));

                                    return {
                                      topBladePartSideXOffset: rotatedRightVector.x,
                                      topBladePartSideYOffset: rotatedRightVector.y,
                                    };
                                  })();

                                  const pa = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) + bottomBladePartXOffset - bottomBladePartSideXOffset,
                                    bottomBladePartYOffset - bottomBladePartSideYOffset,
                                    zOffset,
                                  ];
                                  const pb = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) + topBladePartXOffset - topBladePartSideXOffset,
                                    topBladePartYOffset - topBladePartSideYOffset,
                                    zOffset,
                                  ];
                                  const pc = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) + topBladePartXOffset + topBladePartSideXOffset,
                                    topBladePartYOffset + topBladePartSideYOffset,
                                    zOffset,
                                  ];
                                  const pd = [
                                    (width * ((-0.5 + (i / (numBlades - 1))))) + bottomBladePartXOffset + bottomBladePartSideXOffset,
                                    bottomBladePartYOffset + bottomBladePartSideYOffset,
                                    zOffset,
                                  ];

                                  _pushQuadFace(pa, pb, pc, pd);

                                  lastBladePartXOffset = topBladePartXOffset;
                                  lastBladePartYOffset = topBladePartYOffset;
                                }
                              }

                              return result;
                            })();
                            colors = _makeColors(numTriangles);
                          } else if (type === 'bulby') {
                            const numBlades = 6 + Math.floor(grassRng() * (6 + 1));
                            const bulbPartsSpec = (() => {
                              const result = Array(numBlades);
                              for (let i = 0; i < numBlades; i++) {
                                result[i] = {
                                  topBulb: grassRng() < 0.5,
                                  sideBulbs: 0 + Math.floor(grassRng() * (4 + 1)),
                                };
                              }
                              return result;
                            })();
                            const totalNumBladeParts = (() => {
                              let result = 0;
                              for (let i = 0; i < bulbPartsSpec.length; i++) {
                                const bulbParts = bulbPartsSpec[i];
                                const {topBulb, sideBulbs} = bulbParts;
                                result += 1 /* root blade part */ + (topBulb ? 1 : 0) + sideBulbs;
                              }
                              return result;
                            })();
                            const numTriangles = totalNumBladeParts * 3 * 2 * 2;
                            positions = (() => {
                              const result = new Float32Array(numTriangles * 3);

                              const _pushQuadFace = _makeQuadFacePusher(result);

                              const width = 0.5 + (grassRng() * 0.5);
                              const height = 0.25 + (grassRng() * 0.75);
                              for (let i = 0; i < numBlades; i++) {
                                const bulbParts = bulbPartsSpec[i];
                                const {topBulb, sideBulbs} = bulbParts;

                                const bladeWidth = (width / numBlades) * (0.25 + (grassRng() * 0.25));
                                const bladeHeight = height * (0.75 + (grassRng() * 0.25));
                                const xOffset = width * (-0.5 + (i / (numBlades - 1)));
                                const zOffset = -0.025 + (grassRng() * 0.05);
                                const pa = [
                                  xOffset - (bladeWidth / 2),
                                  0,
                                  zOffset,
                                ];
                                const pb = [
                                  xOffset - (bladeWidth / 2),
                                  bladeHeight,
                                  zOffset,
                                ];
                                const pc = [
                                  xOffset + (bladeWidth / 2),
                                  bladeHeight,
                                  zOffset,
                                ];
                                const pd = [
                                  xOffset + (bladeWidth / 2),
                                  0,
                                  zOffset,
                                ];

                                _pushQuadFace(pa, pb, pc, pd);

                                const topBulbWidth = 1.5 * bladeWidth;
                                const topBulbHeight = 2 * topBulbWidth;
                                const sideBulbSize = bladeWidth;
                                const _pushBulb = (x, y, bulbWidth, bulbHeight) => {
                                  const pa = [
                                    x - (bulbWidth / 2),
                                    y + (bulbHeight / 2),
                                    zOffset,
                                  ];
                                  const pb = [
                                    x - (bulbWidth / 2),
                                    y - (bulbHeight / 2),
                                    zOffset,
                                  ];
                                  const pc = [
                                    x + (bulbWidth / 2),
                                    y - (bulbHeight / 2),
                                    zOffset,
                                  ];
                                  const pd = [
                                    x + (bulbWidth / 2),
                                    y + (bulbHeight / 2),
                                    zOffset,
                                  ];

                                  _pushQuadFace(pa, pb, pc, pd);
                                };

                                if (topBulb) {
                                  _pushBulb(xOffset, bladeHeight, topBulbWidth, topBulbHeight);
                                }

                                for (let j = 0; j < sideBulbs; j++) {
                                  const bulbX = (grassRng() < 0.5) ? (xOffset - sideBulbSize) : (xOffset + sideBulbSize);
                                  const bulbY = grassRng() * bladeHeight;
                                  _pushBulb(bulbX, bulbY, sideBulbSize, sideBulbSize);
                                }
                              }

                              return result;
                            })();
                            colors = _makeColors(numTriangles);
                          } else if (type === 'leafy') { // XXX
                            const numBlades = 4 + Math.floor(grassRng() * (4 + 1));
                            const bladePartsSpec = (() => {
                              const result = Array(numBlades);
                              for (let i = 0; i < numBlades; i++) {
                                result[i] = 6 + Math.floor(grassRng() * (10 + 1));
                              }
                              return result;
                            })();
                            const totalNumBladeParts = funUtils.sum(bladePartsSpec);
                            const numTriangles = totalNumBladeParts * 3 * 2 * 2;
                            positions = (() => {
                              const result = new Float32Array(numTriangles * 3);

                              const _pushQuadFace = _makeQuadFacePusher(result);

                              const width = 0.5 + (grassRng() * 0.5);
                              const height = 0.25 + (grassRng() * 0.75);
                              for (let i = 0; i < numBlades; i++) {
                                const bladeWidth = (width / numBlades) * (0.25 + (grassRng() * 0.25));
                                const bladeHeight = height * (0.75 + (grassRng() * 0.25));
                                const xOffset = width * (-0.5 + (i / (numBlades - 1)));
                                const zOffset = -0.025 + (grassRng() * 0.05);
                                const pa = [
                                  xOffset - (bladeWidth / 2),
                                  0,
                                  zOffset,
                                ];
                                const pb = [
                                  xOffset - (bladeWidth / 2),
                                  bladeHeight,
                                  zOffset,
                                ];
                                const pc = [
                                  xOffset + (bladeWidth / 2),
                                  bladeHeight,
                                  zOffset,
                                ];
                                const pd = [
                                  xOffset + (bladeWidth / 2),
                                  0,
                                  zOffset,
                                ];

                                _pushQuadFace(pa, pb, pc, pd);

                                const topBulbWidth = 1.5 * bladeWidth;
                                const topBulbHeight = 2 * topBulbWidth;
                                const sideBulbSize = bladeWidth;
                                const _pushBulb = (x, y, bulbWidth, bulbHeight) => {
                                  const pa = [
                                    x - (bulbWidth / 2),
                                    y + (bulbHeight / 2),
                                    zOffset,
                                  ];
                                  const pb = [
                                    x - (bulbWidth / 2),
                                    y - (bulbHeight / 2),
                                    zOffset,
                                  ];
                                  const pc = [
                                    x + (bulbWidth / 2),
                                    y - (bulbHeight / 2),
                                    zOffset,
                                  ];
                                  const pd = [
                                    x + (bulbWidth / 2),
                                    y + (bulbHeight / 2),
                                    zOffset,
                                  ];

                                  _pushQuadFace(pa, pb, pc, pd);
                                };

                                const hasTopBulb = grassRng() < 0.5;
                                if (hasTopBulb) {
                                  _pushBulb(xOffset, bladeHeight, topBulbWidth, topBulbHeight);
                                }

                                const numBulbs = 0 + Math.floor(grassRng() * (4 + 1));
                                for (let j = 0; j < numBulbs; j++) {
                                  const bulbX = (grassRng() < 0.5) ? (xOffset - sideBulbSize) : (xOffset + sideBulbSize);
                                  const bulbY = grassRng() * bladeHeight;
                                  _pushBulb(bulbX, bulbY, sideBulbSize, sideBulbSize);
                                }
                              }

                              return result;
                            })();
                            colors = _makeColors(numTriangles);
                          }

                          const frontGeometry = new THREE.BufferGeometry();
                          frontGeometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                          frontGeometry.computeVertexNormals();
                          frontGeometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

                          const geometry = _cropizeGeometry(frontGeometry);
                          const position = [
                            -0.5 + grassRng(),
                            -0.5 + grassRng(),
                          ];
                          geometry.applyMatrix(new THREE.Matrix4().makeTranslation(position[0], 0, position[1]));
                          const rotation = grassRng() * (Math.PI * 2);
                          geometry.applyMatrix(new THREE.Matrix4().makeRotationY(rotation));

                          return geometry;
                        })();
                        const material = grassMaterial;

                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.position.x = x;
                        mesh.position.y = 0;
                        mesh.position.z = z;
                        mesh.rotation.y = Math.PI / 2;
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;

                        return mesh;
                      })();

                      mesh.add(grass);
                    }

                    return mesh;
                  })();
                  scene.add(mesh);

                  this._cleanup = () => {
                    scene.remove(mesh);
                  };
                }

                destructor() {
                  this._cleanup();
                }
              },
            ],
            templates: [
              {
                tag: 'vegetation.tree',
                attributes: {},
                children: [],
              },
              {
                tag: 'vegetation.grass',
                attributes: {},
                children: [],
              },
            ],
          };
        }
      });
  }
}
