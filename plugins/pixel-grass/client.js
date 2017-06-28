import functionutils from 'functionutils';

export default class PixelGrass {
  mount() {
    const {three: {THREE}, elements, utils: {random: {alea}}} = zeo;

    const grassEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

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

        const grassRng = new alea('');

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
                  const totalNumBladeParts = functionutils.sum(bladePartsSpec);
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
                  const totalNumBladeParts = functionutils.sum(bladePartsSpec);
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
                  const totalNumBladeParts = functionutils.sum(bladePartsSpec);
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
                  const totalNumBladeParts = functionutils.sum(bladePartsSpec);
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
        entityObject.add(mesh);

        entityApi._cleanup = () => {
          entityObject.remove(mesh);
        };
      },
      destructor(entityElement) {
        const entityApi = entityElement.getEntityApi();

        entityApi._cleanup();
      },
    };
    elements.registerEntity(this, grassEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, grassEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}
