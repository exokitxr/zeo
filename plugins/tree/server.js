const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 30 * 1024;
const CAMERA_ROTATION_ORDER = 'YXZ';

class Tree {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app} = archae.getCore();
    const {three, elements} = zeo;
    const {THREE} = three;

    const upVector = new THREE.Vector3(0, 1, 0);
    const sideQuaternion = new THREE.Quaternion().setFromUnitVectors(
      upVector,
      new THREE.Vector3(1, 0, 0)
    );

    const _requestTreeTemplates = () => new Promise((accept, reject) => {
      const _makeIndexArray = n => {
        const result = new Uint16Array(n * 3 * 2);
        for (let i = 0; i < n; i++) {
          const baseIndexIndex = i * 3 * 2;
          const baseAttributeIndex = i * 3;

          // double side
          result[baseIndexIndex + 0] = baseAttributeIndex + 0;
          result[baseIndexIndex + 1] = baseAttributeIndex + 1;
          result[baseIndexIndex + 2] = baseAttributeIndex + 2;

          result[baseIndexIndex + 3] = baseAttributeIndex + 0;
          result[baseIndexIndex + 4] = baseAttributeIndex + 2;
          result[baseIndexIndex + 5] = baseAttributeIndex + 1;
        }
        return result;
      };
      const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
        for (let i = 0; i < src.length; i++) {
          dst[startIndexIndex + i] = src[i] + startAttributeIndex;
        }
      };
      const leafGeometries = [ // same for all trees
        (() => {
          const geometry = new THREE.BufferGeometry();
          const positions = Float32Array.from([
            0, 0, 0,
            -0.05, 0.1, 0,
            0.05, 0.1, 0,

            -0.05, 0.1, 0,
            0, 0.2, 0,
            0.05, 0.1, 0,
          ]);
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          const lightColor = new THREE.Color(0x8BC34A);
          const darkColor = lightColor.clone().multiplyScalar(0.25);
          const colors = Float32Array.from([
            lightColor.r, lightColor.g, lightColor.b,
            darkColor.r, darkColor.g, darkColor.b,
            darkColor.r, darkColor.g, darkColor.b,

            darkColor.r, darkColor.g, darkColor.b,
            lightColor.r, lightColor.g, lightColor.b,
            darkColor.r, darkColor.g, darkColor.b,
          ]);
          geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
          geometry.computeVertexNormals();
          geometry.setIndex(new THREE.BufferAttribute(_makeIndexArray(positions.length / 9), 1));

          return geometry;
        })(),
        (() => {
          const geometry = new THREE.BufferGeometry();
          const positions = Float32Array.from([
            0, 0, -0.05,
            -0.1, 0.2, -0.05,
            0, 0.1, -0.05,

            0, 0, 0,
            0.1, 0.2, 0,
            0, 0.1, 0,
          ]);
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          const lightColor = new THREE.Color(0x8BC34A);
          const darkColor = lightColor.clone().multiplyScalar(0.25);
          const colors = Float32Array.from([
            darkColor.r, darkColor.g, darkColor.b,
            lightColor.r, lightColor.g, lightColor.b,
            darkColor.r, darkColor.g, darkColor.b,

            darkColor.r, darkColor.g, darkColor.b,
            lightColor.r, lightColor.g, lightColor.b,
            darkColor.r, darkColor.g, darkColor.b,
          ]);
          geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
          geometry.computeVertexNormals();
          geometry.setIndex(new THREE.BufferAttribute(_makeIndexArray(positions.length / 9), 1));

          return geometry;
        })(),
        (() => {
          const geometry = new THREE.BufferGeometry();
          const positions = Float32Array.from([
            0, 0, -0.05,
            -0.15, 0.15, -0.05,
            0, 0.175, -0.05,

            0, 0, -0.05,
            0.15, 0.15, -0.05,
            0, 0.175, -0.05,

            -0.075, 0.075, 0,
            0, 0.275, 0,
            0.075, 0.075, 0,
          ]);
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          const lightColor = new THREE.Color(0x8BC34A);
          const darkColor = lightColor.clone().multiplyScalar(0.25);
          const colors = Float32Array.from([
            darkColor.r, darkColor.g, darkColor.b,
            lightColor.r, lightColor.g, lightColor.b,
            lightColor.r, lightColor.g, lightColor.b,

            darkColor.r, darkColor.g, darkColor.b,
            lightColor.r, lightColor.g, lightColor.b,
            lightColor.r, lightColor.g, lightColor.b,

            darkColor.r, darkColor.g, darkColor.b,
            lightColor.r, lightColor.g, lightColor.b,
            darkColor.r, darkColor.g, darkColor.b,
          ]);
          geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
          geometry.computeVertexNormals();
          geometry.setIndex(new THREE.BufferAttribute(_makeIndexArray(positions.length / 9), 1));

          return geometry;
        })(),
      ];

      const trunkGeometries = [
        (() => {
          const radiusBottom = 0.3 + Math.random() * 0.3;
          const radiusTop = radiusBottom * (0.2 + (Math.random() * 0.3));
          const heightSegments = 16;
          const radialSegments = 5;
          const geometry = new THREE.CylinderBufferGeometry(radiusTop, radiusBottom, heightSegments, radialSegments, heightSegments);
          geometry.removeAttribute('normal');
          geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, heightSegments / 2, 0));
          const positions = geometry.getAttribute('position').array;

          const heightOffsets = {};
          let heightOffset = new THREE.Vector3();
          heightOffsets[0] = heightOffset;
          for (let i = 1; i <= heightSegments; i++) {
            heightOffset = heightOffset.clone()
               .multiplyScalar(0.8)
              .add(new THREE.Vector3(
                -0.6 + (Math.random() * 0.6),
                0,
                -0.6 + (Math.random() * 0.6)
              ));
            heightOffsets[i] = heightOffset;
          }

          const numPositions = positions.length / 3;
          const colors = new Float32Array(numPositions * 3);
          const baseColor = new THREE.Color(0x795548);

          for (let i = 0; i < numPositions; i++) {
            const baseIndex = i * 3;
            const y = positions[baseIndex + 1];
            const heightOffset = heightOffsets[y];
            const c = baseColor.clone().multiplyScalar(0.1 + (((y + 1) / heightSegments) * (1 - 0.1)));

            positions[baseIndex + 0] += heightOffset.x;
            // positions[baseIndex + 1] += heightOffset.y;
            positions[baseIndex + 2] += heightOffset.z;

            colors[baseIndex + 0] = c.r;
            colors[baseIndex + 1] = c.g;
            colors[baseIndex + 2] = c.b;
          }

          geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
          geometry.computeVertexNormals();

          geometry.heightSegments = heightSegments;
          geometry.radialSegments = radialSegments;
          geometry.heightOffsets = heightOffsets;

          return geometry;
        })(),
      ];
      const _makeTreeBranchGeometry = heightSegments => {
        const radiusBottom = 0.1 + Math.random() * 0.1;
        const radiusTop = radiusBottom * (0.2 + (Math.random() * 0.3));
        const radialSegments = 3;
        const geometry = new THREE.CylinderBufferGeometry(radiusTop, radiusBottom, heightSegments, radialSegments, heightSegments);
        geometry.removeAttribute('normal');
        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, heightSegments / 2, 0));
        const positions = geometry.getAttribute('position').array;

        const heightOffsets = {};
        let heightOffset = new THREE.Vector3();
        heightOffsets[0] = heightOffset;
        for (let i = 1; i <= heightSegments; i++) {
          heightOffset = heightOffset.clone()
             .multiplyScalar(0.8)
            .add(new THREE.Vector3(
              -0.6 + (Math.random() * 0.6),
              0,
              -0.6 + (Math.random() * 0.6)
            ));
          heightOffsets[i] = heightOffset;
        }

        const numPositions = positions.length / 3;
        const colors = new Float32Array(numPositions * 3);
        const baseColor = new THREE.Color(0x795548);

        for (let i = 0; i < numPositions; i++) {
          const baseIndex = i * 3;
          const y = positions[baseIndex + 1];
          const heightOffset = heightOffsets[y];
          const c = baseColor.clone().multiplyScalar(0.7 + (((y + 1) / heightSegments) * (1 - 0.7)));

          positions[baseIndex + 0] += heightOffset.x;
          // positions[baseIndex + 1] += heightOffset.y;
          positions[baseIndex + 2] += heightOffset.z;

          colors[baseIndex + 0] = c.r;
          colors[baseIndex + 1] = c.g;
          colors[baseIndex + 2] = c.b;
        }

        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(sideQuaternion));
        geometry.computeVertexNormals();

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
        const normals = new Float32Array(NUM_POSITIONS * 3);
        const colors = new Float32Array(NUM_POSITIONS * 3);
        const indices = new Uint16Array(NUM_POSITIONS * 3);
        let attributeIndex = 0;
        let indexIndex = 0;

        const _renderTrunk = () => {
          const trunkGeometry = trunkGeometries[Math.floor(Math.random() * trunkGeometries.length)];
          const geometry = trunkGeometry;
          const newPositions = geometry.getAttribute('position').array;
          positions.set(newPositions, attributeIndex);
          const newNormals = geometry.getAttribute('normal').array;
          normals.set(newNormals, attributeIndex);
          const newColors = geometry.getAttribute('color').array;
          colors.set(newColors, attributeIndex);
          const newIndices = geometry.index.array;
          _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

          attributeIndex += newPositions.length;
          indexIndex += newIndices.length;

          return trunkGeometry;
        };
        const trunkGeometrySpec = _renderTrunk();

        const _renderBranches = trunkGeometrySpec => {
          const {heightSegments, heightOffsets} = trunkGeometrySpec;

          const branchGeometrySpec = [];
          for (let i = Math.floor(heightSegments * 0.4); i < heightSegments; i++) {
            const heightOffset = heightOffsets[i];

            const maxNumBranchesPerNode = 4;
            const optimalBranchHeight = 0.7;
            const branchWeight = 1 - Math.pow(Math.abs(i - (heightSegments * optimalBranchHeight)) / (heightSegments * optimalBranchHeight), 0.25);
            for (let j = 0; j < maxNumBranchesPerNode; j++) {
              if (Math.random() < branchWeight) {
                const branchSizeIndex = branchWeight === 1 ? (branchGeometrySizes.length - 1) : Math.floor(branchWeight * branchGeometrySizes.length);
                const branchGeometries = branchGeometrySizes[branchSizeIndex];
                const branchGeometry = branchGeometries[Math.floor(Math.random() * branchGeometries.length)];
                const geometry = branchGeometry
                  .clone()
                  .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                    Math.random() * Math.PI / 6,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI / 6,
                    CAMERA_ROTATION_ORDER
                  )))
                  .applyMatrix(new THREE.Matrix4().makeTranslation(
                    heightOffset.x,
                    i,
                    heightOffset.z
                  ));
                const newPositions = geometry.getAttribute('position').array;
                positions.set(newPositions, attributeIndex);
                const newNormals = geometry.getAttribute('normal').array;
                normals.set(newNormals, attributeIndex);
                const newColors = geometry.getAttribute('color').array;
                colors.set(newColors, attributeIndex);
                const newIndices = geometry.index.array;
                _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

                branchGeometrySpec.push(geometry);

                attributeIndex += newPositions.length;
                indexIndex += newIndices.length;
              }
            }
          }

          return branchGeometrySpec;
        };
        const branchGeometrySpec = _renderBranches(trunkGeometrySpec);

        const _renderLeaves = branchGeometrySpec => {
          const numLeaves = 100;
          for (let i = 0; i < numLeaves; i++) {
            const branchGeometry = branchGeometrySpec[Math.floor(Math.random() * branchGeometrySpec.length)];
            const branchPositions = branchGeometry.getAttribute('position').array;
            const branchNormals = branchGeometry.getAttribute('normal').array;
            const numPositions = branchPositions.length / 3;
            const baseIndex1 = Math.floor((1 - Math.pow(Math.random(), 0.5)) * numPositions) * 3;
            const baseIndex2 = Math.floor((1 - Math.pow(Math.random(), 0.5)) * numPositions) * 3;
            const lerpFactor = Math.random();
            const inverseLerpFactor = 1 - lerpFactor;

            const leafGeometry = leafGeometries[Math.floor(Math.random() * leafGeometries.length)];
            const geometry = leafGeometry 
              .clone()
              .applyMatrix(new THREE.Matrix4().makeScale(
                8,
                8 + (Math.random() * 8),
                1
              ))
              .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                Math.random() * Math.PI / 2,
                Math.random() * (Math.PI * 2),
                0,
                CAMERA_ROTATION_ORDER
              )))
              .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                upVector,
                new THREE.Vector3(
                  (branchNormals[baseIndex1 + 0] * lerpFactor + branchNormals[baseIndex2 + 0] * inverseLerpFactor),
                  (branchNormals[baseIndex1 + 1] * lerpFactor + branchNormals[baseIndex2 + 1] * inverseLerpFactor),
                  (branchNormals[baseIndex1 + 2] * lerpFactor + branchNormals[baseIndex2 + 2] * inverseLerpFactor)
                )
              )))
              .applyMatrix(new THREE.Matrix4().makeTranslation(
                (branchPositions[baseIndex1 + 0] * lerpFactor + branchPositions[baseIndex2 + 0] * inverseLerpFactor),
                (branchPositions[baseIndex1 + 1] * lerpFactor + branchPositions[baseIndex2 + 1] * inverseLerpFactor),
                (branchPositions[baseIndex1 + 2] * lerpFactor + branchPositions[baseIndex2 + 2] * inverseLerpFactor)
              ));

            const newPositions = geometry.getAttribute('position').array;
            positions.set(newPositions, attributeIndex);
            const newNormals = geometry.getAttribute('normal').array;
            normals.set(newNormals, attributeIndex);
            const newColors = geometry.getAttribute('color').array;
            colors.set(newColors, attributeIndex);
            const newIndices = geometry.index.array;
            _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

            attributeIndex += newPositions.length;
            indexIndex += newIndices.length;
          }
        };
        _renderLeaves(branchGeometrySpec);

        return {
          positions: new Float32Array(positions.buffer, positions.byteOffset, attributeIndex),
          normals: new Float32Array(normals.buffer, normals.byteOffset, attributeIndex),
          colors: new Float32Array(colors.buffer, colors.byteOffset, attributeIndex),
          indices: new Uint16Array(indices.buffer, indices.byteOffset, indexIndex),
        };
      })();

      accept(treeGeometry);
    });
    const _makeTreeTemplatesBufferPromise = () => _requestTreeTemplates()
      .then(treeTemplates => protocolUtils.stringifyTreeGeometry(treeTemplates));

    let treeTemplatesBufferPromise = null;
    const _requestTreeTemplatesBuffer = () => {
      if (treeTemplatesBufferPromise === null) {
        treeTemplatesBufferPromise = _makeTreeTemplatesBufferPromise();
      }
      return treeTemplatesBufferPromise;
    };

    function treeTemplates(req, res, next) {
      _requestTreeTemplatesBuffer()
        .then(templatesBuffer => {
          res.type('application/octet-stream');
          res.send(new Buffer(templatesBuffer));
        });
    }
    app.get('/archae/tree/templates', treeTemplates);

    function treeGenerate(req, res, next) {
      const {x: xs, y: ys} = req.query;
      const x = parseInt(xs, 10);
      const y = parseInt(ys, 10);

      if (!isNaN(x) && !isNaN(y)) {
        elements.requestElement('plugins-heightfield')
          .then(heightfieldElement => {
            const mapChunk = heightfieldElement.generate(x, y);
            const {points} = mapChunk;
            console.log('map chunk points', points.length); // XXX
            const treeChunkBuffer = new Float32Array();

            res.type('application/octet-stream');
            res.send(new Buffer(treeChunkBuffer));
          })
          .catch(err => {
            res.status(err.code === 'ETIMEOUT' ? 404 : 500);
            res.send({
              error: err.stack,
            });
          });
      } else {
        res.status(400);
        res.send();
      }
    }
    app.get('/archae/tree/generate', treeGenerate);

    /* const treeMesh = (() => {
      const positions = new Float32Array(NUM_POSITIONS * 3);
      // const normals = new Float32Array(NUM_POSITIONS * 3);
      const colors = new Float32Array(NUM_POSITIONS * 3);
      let index = 0;

      const numTreesHi = 30;
      for (let i = 0; i < numTreesHi; i++) {
        const treePosition = new THREE.Vector3(
          -10 + (Math.random() * 20),
          0,
          -10 + (Math.random() * 20)
        );
        const treeEuler = new THREE.Euler(0, Math.random() * Math.PI * 2, 0, camera.rotation.order);
        const geometryHi = treeGeometry.geometryHi
          .clone()
          .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(treeEuler))
          .applyMatrix(new THREE.Matrix4().makeTranslation(
            treePosition.x,
            0,
            treePosition.z
          ));
        const newPositions = geometryHi.getAttribute('position').array;
        positions.set(newPositions, index);
        // const newNormals = geometryHi.getAttribute('normal').array;
        // normals.set(newNormals, index);
        const newColors = geometryHi.getAttribute('color').array;
        colors.set(newColors, index);

        index += newPositions.length;
      }
      const numTreesLo = 500;
      for (let i = 0; i < numTreesLo; i++) {
        const treePosition = (() => {
          const corner = Math.floor(Math.random() / 0.25);

          if (corner === 0) {
            return new THREE.Vector3(
              -(10 + (Math.random() * 40)),
              0,
              -50 + (Math.random() * 100)
            );
          } else if (corner === 1) {
            return new THREE.Vector3(
              10 + (Math.random() * 40),
              0,
              -50 + (Math.random() * 100)
            );
          } else if (corner === 2) {
            return new THREE.Vector3(
              -50 + (Math.random() * 100),
              0,
              -(10 + (Math.random() * 40))
            );
          } else {
            return new THREE.Vector3(
              -50 + (Math.random() * 100),
              0,
              10 + (Math.random() * 40)
            );
          }
        })();
        const treeEuler = new THREE.Euler(0, Math.random() * Math.PI * 2, 0, camera.rotation.order);
        const geometryLo = treeGeometry.geometryLo
          .clone()
          .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(treeEuler))
          .applyMatrix(new THREE.Matrix4().makeTranslation(
            treePosition.x,
            0,
            treePosition.z
          ));
        const newPositions = geometryLo.getAttribute('position').array;
        positions.set(newPositions, index);
        // const newNormals = geometryLo.getAttribute('normal').array;
        // normals.set(newNormals, index);
        const newColors = geometryLo.getAttribute('color').array;
        colors.set(newColors, index);

        index += newPositions.length;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, index), 3));
      // geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals.buffer, normals.byteOffset, index), 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, index), 3));

      const material = treeMaterial;
      const mesh = new THREE.Mesh(geometry, material);
      return mesh;
    })();
    scene.add(treeMesh); */

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'treeTemplates' ||
          route.handle.name === 'treeGenerate'
        ) {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    };
  }

  unmount() {
    this._cleanup();
  } 
};

module.exports = Tree;
