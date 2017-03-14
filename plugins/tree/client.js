export default class Tree {
  mount() {
    const {three: {THREE, scene}, elements, utils: {random: {alea}}} = zeo;

    class TreeElement extends HTMLElement {
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

        const treeRng = new alea('');

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
    }

    elements.registerElement(this, TreeElement);

    this._cleanup = () => {
      elements.unregisterElement(this);
    };
  }

  unmount() {
    this._cleanup();
  }
}
