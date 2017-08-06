const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const tree = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene} = three;

  const localVector = new THREE.Vector3();

  const _requestImage = src => new Promise((accept, reject) => {
    const img = new Image();
    img.onload = () => {
      accept(img);
    };
    img.onerror = err => {
      reject(img);
    };
    img.src = src;
  });
  const _registerTexture = (src, name) => _requestImage(src)
    .then(textureImg => objectApi.registerTexture(name, textureImg));

  return () => Promise.all([
    _registerTexture('/archae/objects/img/tree.png', 'tree'),
    _registerTexture('/archae/objects/img/leaf.png', 'leaf'),
  ])
    .then(() => objectApi.registerGeometry('tree', (args) => {
      const {THREE, getUv, rng} = args;

      const NUM_POSITIONS = 30 * 1024;
      const CAMERA_ROTATION_ORDER = 'YXZ';
      const treeUvs = getUv('tree');
      const treeUvWidth = treeUvs[2] - treeUvs[0];
      const treeUvHeight = treeUvs[3] - treeUvs[1];
      const leafUvs = getUv('leaf');
      const leafUvWidth = leafUvs[2] - leafUvs[0];
      const leafUvHeight = leafUvs[3] - leafUvs[1];

      const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
        for (let i = 0; i < src.length; i++) {
          dst[startIndexIndex + i] = src[i] + startAttributeIndex;
        }
      };

      const _makeTrunkGeometry = () => {
        const radiusBottom = 0.3 + rng() * 0.3;
        const radiusTop = radiusBottom * (0.2 + (rng() * 0.3));
        const heightSegments = 16;
        const radialSegments = 5;
        const geometry = new THREE.CylinderBufferGeometry(radiusTop, radiusBottom, heightSegments, radialSegments, heightSegments);
        geometry.removeAttribute('normal');
        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, heightSegments / 2, 0));
        const positions = geometry.getAttribute('position').array;
        const uvs = geometry.getAttribute('uv').array;

        const heightOffsets = {};
        let heightOffset = new THREE.Vector3();
        heightOffsets[0] = heightOffset;
        for (let i = 1; i <= heightSegments; i++) {
          heightOffset = heightOffset.clone()
            .multiplyScalar(0.8)
            .add(new THREE.Vector3(
              -0.6 + (rng() * 0.6),
              0,
              -0.6 + (rng() * 0.6)
            ));
          heightOffsets[i] = heightOffset;
        }

        const numPositions = positions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          const baseIndex3 = i * 3;
          const y = positions[baseIndex3 + 1];
          const heightOffset = heightOffsets[y];

          positions[baseIndex3 + 0] += heightOffset.x;
          // positions[baseIndex + 1] += heightOffset.y;
          positions[baseIndex3 + 2] += heightOffset.z;

          const baseIndex2 = i * 2;
          uvs[baseIndex2 + 0] = treeUvs[0] + (uvs[baseIndex2 + 0] * treeUvWidth);
          uvs[baseIndex2 + 1] = (treeUvs[1] + treeUvHeight) - (uvs[baseIndex2 + 1] * treeUvHeight);
        }

        geometry.computeBoundingBox();

        geometry.heightSegments = heightSegments;
        geometry.radialSegments = radialSegments;
        geometry.heightOffsets = heightOffsets;

        return geometry;
      };
      const trunkGeometries = (() => {
        const numTrunkGeometries = 8;
        const result = Array(numTrunkGeometries);
        for (let i = 0; i < numTrunkGeometries; i++) {
          result[i] = _makeTrunkGeometry();
        }
        return result;
      })();
      const _makeTreeBranchGeometry = heightSegments => {
        const radiusBottom = 0.1 + rng() * 0.1;
        const radiusTop = radiusBottom * (0.2 + (rng() * 0.3));
        const radialSegments = 3;

        const geometry = new THREE.CylinderBufferGeometry(radiusTop, radiusBottom, heightSegments, radialSegments, heightSegments);
        geometry.removeAttribute('normal');
        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, heightSegments / 2, 0));
        const positions = geometry.getAttribute('position').array;
        const uvs = geometry.getAttribute('uv').array;

        const heightOffsets = {};
        let heightOffset = new THREE.Vector3();
        heightOffsets[0] = heightOffset;
        for (let i = 1; i <= heightSegments; i++) {
          heightOffset = heightOffset.clone()
             .multiplyScalar(0.8)
            .add(new THREE.Vector3(
              -0.6 + (rng() * 0.6),
              0,
              -0.6 + (rng() * 0.6)
            ));
          heightOffsets[i] = heightOffset;
        }

        const numPositions = positions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          const baseIndex3 = i * 3;
          const y = positions[baseIndex3 + 1];
          const heightOffset = heightOffsets[y];

          positions[baseIndex3 + 0] += heightOffset.x;
          // positions[baseIndex + 1] += heightOffset.y;
          positions[baseIndex3 + 2] += heightOffset.z;

          const baseIndex2 = i * 2;
          uvs[baseIndex2 + 0] = treeUvs[0] + (uvs[baseIndex2 + 0] * treeUvWidth);
          uvs[baseIndex2 + 1] = treeUvs[1] + (uvs[baseIndex2 + 1] * treeUvHeight);
        }

        geometry.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(1, 0, 0)
        )));

        return geometry;
      };
      const _makeTreeBranchGeometrySize = heightSegments => {
        const numChoices = 4;
        const result = Array(numChoices);
        for (let i = 0; i < numChoices; i++) {
          result[i] = _makeTreeBranchGeometry(heightSegments);
        };
        return result;
      };
      const branchGeometrySizes = [
        _makeTreeBranchGeometrySize(4),
        _makeTreeBranchGeometrySize(5),
        _makeTreeBranchGeometrySize(6),
        _makeTreeBranchGeometrySize(7),
        _makeTreeBranchGeometrySize(8),
        _makeTreeBranchGeometrySize(9),
        _makeTreeBranchGeometrySize(10),
      ];
      const treeGeometry = (() => {
        const positions = new Float32Array(NUM_POSITIONS * 3);
        const uvs = new Float32Array(NUM_POSITIONS * 2);
        const indices = new Uint32Array(NUM_POSITIONS);
        let attributeIndex = 0;
        let uvIndex = 0;
        let indexIndex = 0;

        const _renderTrunk = () => {
          const trunkGeometry = trunkGeometries[Math.floor(rng() * trunkGeometries.length)];
          const geometry = trunkGeometry;
          const newPositions = geometry.getAttribute('position').array;
          positions.set(newPositions, attributeIndex);
          const newUvs = geometry.getAttribute('uv').array;
          uvs.set(newUvs, uvIndex);
          const newIndices = geometry.index.array;
          _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

          attributeIndex += newPositions.length;
          uvIndex += newUvs.length;
          indexIndex += newIndices.length;

          return trunkGeometry;
        };
        const trunkGeometrySpec = _renderTrunk();

        const _renderBranches = trunkGeometrySpec => {
          const {heightSegments, heightOffsets} = trunkGeometrySpec;

          const branchGeometrySpec = [];
          for (let i = Math.floor(heightSegments * 0.4); i < heightSegments; i++) {
            const heightOffset = heightOffsets[i];

            const maxNumBranchesPerNode = 2;
            const optimalBranchHeight = 0.7;
            const branchWeight = 1 - Math.pow(Math.abs(i - (heightSegments * optimalBranchHeight)) / (heightSegments * optimalBranchHeight), 0.3);
            for (let j = 0; j < maxNumBranchesPerNode; j++) {
              if (rng() < branchWeight) {
                const branchSizeIndex = branchWeight === 1 ? (branchGeometrySizes.length - 1) : Math.floor(branchWeight * branchGeometrySizes.length);
                const branchGeometries = branchGeometrySizes[branchSizeIndex];
                const branchGeometry = branchGeometries[Math.floor(rng() * branchGeometries.length)];
                const geometry = branchGeometry
                  .clone()
                  .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                    rng() * Math.PI / 6,
                    rng() * Math.PI * 2,
                    rng() * Math.PI / 6,
                    CAMERA_ROTATION_ORDER
                  )))
                  .applyMatrix(new THREE.Matrix4().makeTranslation(
                    heightOffset.x,
                    i,
                    heightOffset.z
                  ));
                const newPositions = geometry.getAttribute('position').array;
                positions.set(newPositions, attributeIndex);
                const newUvs = geometry.getAttribute('uv').array;
                uvs.set(newUvs, uvIndex);
                const newIndices = geometry.index.array;
                _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

                branchGeometrySpec.push(geometry);

                attributeIndex += newPositions.length;
                uvIndex += newUvs.length;
                indexIndex += newIndices.length;
              }
            }
          }

          return branchGeometrySpec;
        };
        const branchGeometrySpec = _renderBranches(trunkGeometrySpec);

        const _renderLeaves = branchGeometrySpec => {
          const numLeaves = 50;
          for (let i = 0; i < numLeaves; i++) {
            const branchGeometry = branchGeometrySpec[Math.floor(rng() * branchGeometrySpec.length)];
            const branchPositions = branchGeometry.getAttribute('position').array;
            // const branchNormals = branchGeometry.getAttribute('normal').array;
            const numPositions = branchPositions.length / 3;
            // const index1 = Math.floor((1 - Math.pow(rng(), 0.5)) * numPositions);
            const index1 = Math.floor(rng() * numPositions);
            const index2 = (index1 < (numPositions - 1)) ? (index1 + 1) : (index1 - 1); // XXX bugfix this to scan to a position with a different y
            const baseIndex1 = index1 * 3;
            const baseIndex2 = index2 * 3;
            const lerpFactor = rng();
            const inverseLerpFactor = 1 - lerpFactor;

            const geometry = new THREE.PlaneBufferGeometry(1, 1)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, 0))
              .applyMatrix(new THREE.Matrix4().makeScale(
                3,
                3,
                1
              ))
              .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                rng() * Math.PI / 2,
                rng() * (Math.PI * 2),
                0,
                CAMERA_ROTATION_ORDER
              )))
              /* .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                upVector,
                new THREE.Vector3(
                  (branchNormals[baseIndex1 + 0] * lerpFactor + branchNormals[baseIndex2 + 0] * inverseLerpFactor),
                  (branchNormals[baseIndex1 + 1] * lerpFactor + branchNormals[baseIndex2 + 1] * inverseLerpFactor),
                  (branchNormals[baseIndex1 + 2] * lerpFactor + branchNormals[baseIndex2 + 2] * inverseLerpFactor)
                )
              ))) */
              .applyMatrix(new THREE.Matrix4().makeTranslation(
                (branchPositions[baseIndex1 + 0] * lerpFactor + branchPositions[baseIndex2 + 0] * inverseLerpFactor),
                (branchPositions[baseIndex1 + 1] * lerpFactor + branchPositions[baseIndex2 + 1] * inverseLerpFactor),
                (branchPositions[baseIndex1 + 2] * lerpFactor + branchPositions[baseIndex2 + 2] * inverseLerpFactor)
              ));

            const newPositions = geometry.getAttribute('position').array;
            positions.set(newPositions, attributeIndex);
            const newUvs = geometry.getAttribute('uv').array;
            const numNewUvs = newUvs.length / 2;
            for (let j = 0; j < numNewUvs; j++) {
              const baseIndex = j * 2;
              newUvs[baseIndex + 0] = leafUvs[0] + (newUvs[baseIndex + 0] * leafUvWidth);
              newUvs[baseIndex + 1] = leafUvs[1] + (newUvs[baseIndex + 1] * leafUvHeight);
            }
            uvs.set(newUvs, uvIndex);
            const newIndices = geometry.index.array;
            _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

            attributeIndex += newPositions.length;
            uvIndex += newUvs.length;
            indexIndex += newIndices.length;
          }
        };
        _renderLeaves(branchGeometrySpec);

        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
        geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex), 2));
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices.buffer, indices.byteOffset, indexIndex), 1));
        geometry.boundingBox = trunkGeometrySpec.boundingBox;
        return geometry;
      })();

      return treeGeometry;
    }))
    .then(() => {
      /* const treeItemApi = {
        asset: 'ITEM.WOOD',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
              localVector.set(
                grabbable.position.x,
                heightfieldElement ? heightfieldElement.getElevation(grabbable.position.x, grabbable.position.z) : 0,
                grabbable.position.z
              );
              objectApi.addObject('tree', localVector);

              items.destroyItem(grabbable);

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);

          grabbable[dataSymbol] = {
            cleanup: () => {
              input.removeListener('triggerdown', _triggerdown);
            },
          };
        },
        itemRemovedCallback(grabbable) {
          const {[dataSymbol]: {cleanup}} = grabbable;
          cleanup();

          delete grabbable[dataSymbol];
        },
      };
      items.registerItem(this, treeItemApi); */

      const trees = [];
      let Lightmapper = null;
      let lightmapper = null;
      const _bindLightmap = tree => {
        const shape = new Lightmapper.Cylinder(tree.position.x, tree.position.y, tree.position.z, 12, 8, 0.1, Lightmapper.SubBlend);
        lightmapper.add(shape);
        tree.shape = shape;
      };
      const _unbindLightmap = tree => {
        lightmapper.remove(tree.shape);
        tree.shape = null;
      };
      const lightmapElementListener = elements.makeListener(LIGHTMAP_PLUGIN); // XXX destroy this
      lightmapElementListener.on('add', entityElement => {
        Lightmapper = entityElement.Lightmapper;
        lightmapper = entityElement.lightmapper;

        for (let i = 0; i < trees.length; i++) {
          _bindLightmap(trees[i]);
        }
      });
      lightmapElementListener.on('remove', () => {
        Lightmapper = null;
        lightmapper = null;

        for (let i = 0; i < trees.length; i++) {
          trees[i].shape = null;
        }
      });

      const treeObjectApi = {
        object: 'tree',
        // offset: [0, 0.2/2, 0],
        // size: 0.3,
        objectAddedCallback(object) {
          object.on('grip', side => {
            const id = _makeId();
            const asset = 'ITEM.WOOD';
            const assetInstance = items.makeItem({
              type: 'asset',
              id: id,
              name: asset,
              displayName: asset,
              attributes: {
                position: {value: DEFAULT_MATRIX},
                asset: {value: asset},
                quantity: {value: 1},
                owner: {value: null},
                bindOwner: {value: null},
                physics: {value: false},
              },
            });
            assetInstance.grab(side);

            object.remove();
          });

          object.shape = null;
          if (lightmapper) {
            _bindLightmap(object);
          }

          trees.push(object);
        },
        objectRemovedCallback(object) {
          if (lightmapper) {
            _unbindLightmap(object);
          }

          trees.splice(trees.indexOf(object), 1);
        },
      };
      objectApi.registerObject(treeObjectApi);

      return () => {
        // items.unregisterItem(this, treeItemApi);
        // objectApi.unregisterObject(treeObjectApi);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = tree;
