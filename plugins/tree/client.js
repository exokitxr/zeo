const NUM_POSITIONS = 30 * 1024;

class Tree {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, utils: {geometry: geometryUtils}} = zeo;
    const {THREE, scene, camera} = three;

    const upVector = new THREE.Vector3(0, 1, 0);
    const sideQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(1, 0, 0)
    );

    const treeMaterial = new THREE.MeshLambertMaterial({
      // color: 0xFFFFFF,
      // shininess: 0,
      // shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      // side: THREE.DoubleSide,
    });

    const treeCoreGeometries = [
      (() => {
        const radiusBottom = 0.3 + Math.random() * 0.5;
        const radiusTop = radiusBottom * (0.2 + (Math.random() * 0.3));
        const heightSegments = 16;
        const radialSegments = 5;
        const geometry = geometryUtils.unindexBufferGeometry(new THREE.CylinderBufferGeometry(radiusTop, radiusBottom, heightSegments, radialSegments, heightSegments))
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, heightSegments / 2, 0));
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

        let index = 0;
        for (let i = 0; i < numPositions; i++) {
          const baseIndex = index * 3;
          const y = positions[baseIndex + 1];
          const heightOffset = heightOffsets[y];
          const c = baseColor.clone().multiplyScalar(0.1 + (((y + 1) / heightSegments) * (1 - 0.1)));

          positions[baseIndex + 0] += heightOffset.x;
          // positions[baseIndex + 1] += heightOffset.y;
          positions[baseIndex + 2] += heightOffset.z;

          colors[baseIndex + 0] = c.r;
          colors[baseIndex + 1] = c.g;
          colors[baseIndex + 2] = c.b;

          index++;
        }

        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

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
      const geometry = geometryUtils.unindexBufferGeometry(new THREE.CylinderBufferGeometry(radiusTop, radiusBottom, heightSegments, radialSegments, heightSegments))
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, heightSegments / 2, 0));
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

      let index = 0;
      for (let i = 0; i < numPositions; i++) {
        const baseIndex = index * 3;
        const y = positions[baseIndex + 1];
        const heightOffset = heightOffsets[y];
        const c = baseColor.clone().multiplyScalar(0.7 + (((y + 1) / heightSegments) * (1 - 0.7)));

        positions[baseIndex + 0] += heightOffset.x;
        // positions[baseIndex + 1] += heightOffset.y;
        positions[baseIndex + 2] += heightOffset.z;

        colors[baseIndex + 0] = c.r;
        colors[baseIndex + 1] = c.g;
        colors[baseIndex + 2] = c.b;

        index++;
      }

      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(sideQuaternion));

      return geometry;
    };
    const _makeTreeBranchGeometries = heightSegments => {
      const numChoices = 4;
      const result = Array(numChoices);
      for (let i = 0; i < numChoices; i++) {
        result[i] = _makeTreeBranchGeometry(heightSegments);
      };
      return result;
    };
    const treeBranchGeometries = [
      _makeTreeBranchGeometries(4),
      _makeTreeBranchGeometries(5),
      _makeTreeBranchGeometries(6),
      _makeTreeBranchGeometries(7),
      _makeTreeBranchGeometries(8),
      _makeTreeBranchGeometries(9),
      _makeTreeBranchGeometries(10),
    ];
    const treeLeafGeometries = [
      (() => {
        const geometry = new THREE.BufferGeometry();
        const positions = Float32Array.from([
          0, 0, 0,
          -0.05, 0.1, 0,
          0.05, 0.1, 0,
          0, 0, 0,
          0.05, 0.1, 0,
          -0.05, 0.1, 0,

          -0.05, 0.1, 0,
          0, 0.2, 0,
          0.05, 0.1, 0,
          -0.05, 0.1, 0,
          0.05, 0.1, 0,
          0, 0.2, 0,
        ]);
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        const lightColor = new THREE.Color(0x8BC34A);
        const darkColor = lightColor.clone().multiplyScalar(0.25);
        const colors = Float32Array.from([
          lightColor.r, lightColor.g, lightColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          lightColor.r, lightColor.g, lightColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          darkColor.r, darkColor.g, darkColor.b,

          darkColor.r, darkColor.g, darkColor.b,
          lightColor.r, lightColor.g, lightColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          lightColor.r, lightColor.g, lightColor.b,
        ]);
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        return geometry;
      })(),
      (() => {
        const geometry = new THREE.BufferGeometry();
        const positions = Float32Array.from([
          0, 0, -0.01,
          -0.1, 0.2, -0.01,
          0, 0.1, -0.01,
          0, 0, -0.01,
          0, 0.1, -0.01,
          -0.1, 0.2, -0.01,

          0, 0, 0,
          0.1, 0.2, 0,
          0, 0.1, 0,
          0, 0, 0,
          0, 0.1, 0,
          0.1, 0.2, 0,
        ]);
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        const lightColor = new THREE.Color(0x8BC34A);
        const darkColor = lightColor.clone().multiplyScalar(0.25);
        const colors = Float32Array.from([
          darkColor.r, darkColor.g, darkColor.b,
          lightColor.r, lightColor.g, lightColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          lightColor.r, lightColor.g, lightColor.b,

          darkColor.r, darkColor.g, darkColor.b,
          lightColor.r, lightColor.g, lightColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          lightColor.r, lightColor.g, lightColor.b,
        ]);
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        return geometry;
      })(),
      (() => {
        const geometry = new THREE.BufferGeometry();
        const positions = Float32Array.from([
          0, 0, -0.01,
          -0.15, 0.15, -0.01,
          0, 0.175, -0.01,
          0, 0, -0.01,
          0, 0.175, -0.01,
          -0.15, 0.15, -0.01,

          0, 0, -0.01,
          0.15, 0.15, -0.01,
          0, 0.175, -0.01,
          0, 0, -0.01,
          0, 0.175, -0.01,
          0.15, 0.15, -0.01,

          -0.075, 0.075, 0,
          0, 0.275, 0,
          0.075, 0.075, 0,
          -0.075, 0.075, 0,
          0.075, 0.075, 0,
          0, 0.275, 0,
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
          lightColor.r, lightColor.g, lightColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          lightColor.r, lightColor.g, lightColor.b,
          lightColor.r, lightColor.g, lightColor.b,

          darkColor.r, darkColor.g, darkColor.b,
          lightColor.r, lightColor.g, lightColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          darkColor.r, darkColor.g, darkColor.b,
          lightColor.r, lightColor.g, lightColor.b,
        ]);
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        return geometry;
      })(),
    ];

    const treeMesh = (() => {
      const numTrees = 1;
      const positions = new Float32Array(NUM_POSITIONS * 3);
      const normals = new Float32Array(NUM_POSITIONS * 3);
      const colors = new Float32Array(NUM_POSITIONS * 3);
      let index = 0;
      for (let i = 0; i < numTrees; i++) {
        const treePosition = new THREE.Vector3(
          -10 + (Math.random() * 20),
          0,
          -10 + (Math.random() * 20)
        );
        const treeEuler = new THREE.Euler(0, Math.random() * Math.PI * 2, 0, camera.rotation.order);

        const _renderCore = () => {
          const treeCoreGeometry = treeCoreGeometries[Math.floor(Math.random() * treeCoreGeometries.length)];
          const geometry = treeCoreGeometry
            .clone()
            .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(treeEuler))
            .applyMatrix(new THREE.Matrix4().makeTranslation(
              treePosition.x,
              0,
              treePosition.z
            ));
          const newPositions = geometry.getAttribute('position').array;
          const newNormals = geometry.getAttribute('normal').array;
          const newColors = geometry.getAttribute('color').array;
          positions.set(newPositions, index);
          normals.set(newNormals, index);
          colors.set(newColors, index);

          index += newPositions.length;

          return treeCoreGeometry;
        };
        const _renderBranches = treeCoreGeometrySpec => {
          const {heightSegments, heightOffsets} = treeCoreGeometrySpec;

          const treeBranchGeometrySpec = [];
          for (let i = Math.floor(heightSegments * 0.4); i < heightSegments; i++) {
            const heightOffset = heightOffsets[i];

            const maxNumBranchesPerNode = 4;
            const optimalBranchHeight = 0.7;
            const branchWeight = 1 - Math.pow(Math.abs(i - (heightSegments * optimalBranchHeight)) / (heightSegments * optimalBranchHeight), 0.25);
            for (let j = 0; j < maxNumBranchesPerNode; j++) {
              if (Math.random() < branchWeight) {
                const branchSizeIndex = branchWeight === 1 ? (treeBranchGeometries.length - 1) : Math.floor(branchWeight * treeBranchGeometries.length);
                const treeBranchGeometryChoices = treeBranchGeometries[branchSizeIndex];
                const treeBranchGeometry = treeBranchGeometryChoices[Math.floor(Math.random() * treeBranchGeometryChoices.length)];
                const heightOffsetLocal = heightOffset.clone().applyEuler(treeEuler);
                const geometry = treeBranchGeometry
                  .clone()
                  .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                    Math.random() * Math.PI / 6,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI / 6,
                    camera.rotation.order
                  )))
                  .applyMatrix(new THREE.Matrix4().makeTranslation(
                    treePosition.x + heightOffsetLocal.x,
                    i,
                    treePosition.z + heightOffsetLocal.z
                  ));
                const newPositions = geometry.getAttribute('position').array;
                positions.set(newPositions, index);
                const newNormals = geometry.getAttribute('normal').array;
                normals.set(newNormals, index);
                const newColors = geometry.getAttribute('color').array;
                colors.set(newColors, index);

                treeBranchGeometrySpec.push(geometry);

                index += newPositions.length;
              }
            }
          }

          return treeBranchGeometrySpec;
        };
        const _renderLeaves = treeBranchGeometrySpec => {
          const numLeaves = 1000;
          for (let i = 0; i < numLeaves; i++) {
            const treeBranchGeometry = treeBranchGeometrySpec[Math.floor(Math.random() * treeBranchGeometrySpec.length)];
            const treeBranchPositions = treeBranchGeometry.getAttribute('position').array;
            const treeBranchNormals = treeBranchGeometry.getAttribute('normal').array;
            const numPositions = treeBranchPositions.length / 3;
            const baseIndex1 = Math.floor((1 - Math.pow(Math.random(), 0.5)) * numPositions) * 3;
            const baseIndex2 = Math.floor((1 - Math.pow(Math.random(), 0.5)) * numPositions) * 3;
            const lerpFactor = Math.random();
            const inverseLerpFactor = 1 - lerpFactor;

            const geometry = treeLeafGeometries[Math.floor(Math.random() * treeLeafGeometries.length)]
              .clone()
              .applyMatrix(new THREE.Matrix4().makeScale(
                5,
                5 + Math.random() * 5,
                1
              ))
              .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                Math.random() * Math.PI / 2,
                Math.random() * (Math.PI * 2),
                0,
                camera.rotation.order
              )))
              .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                upVector,
                new THREE.Vector3(
                  (treeBranchNormals[baseIndex1 + 0] * lerpFactor + treeBranchNormals[baseIndex2 + 0] * inverseLerpFactor),
                  (treeBranchNormals[baseIndex1 + 1] * lerpFactor + treeBranchNormals[baseIndex2 + 1] * inverseLerpFactor),
                  (treeBranchNormals[baseIndex1 + 2] * lerpFactor + treeBranchNormals[baseIndex2 + 2] * inverseLerpFactor)
                )
              )))
              .applyMatrix(new THREE.Matrix4().makeTranslation(
                (treeBranchPositions[baseIndex1 + 0] * lerpFactor + treeBranchPositions[baseIndex2 + 0] * inverseLerpFactor),
                (treeBranchPositions[baseIndex1 + 1] * lerpFactor + treeBranchPositions[baseIndex2 + 1] * inverseLerpFactor),
                (treeBranchPositions[baseIndex1 + 2] * lerpFactor + treeBranchPositions[baseIndex2 + 2] * inverseLerpFactor)
              ));

            const newPositions = geometry.getAttribute('position').array;
            positions.set(newPositions, index);
            const newNormals = geometry.getAttribute('normal').array;
            normals.set(newNormals, index);
            const newColors = geometry.getAttribute('color').array;
            colors.set(newColors, index);

            index += newPositions.length;
          }
        };

        const treeCoreGeometry = _renderCore();
        const treeBranchGeometrySpec = _renderBranches(treeCoreGeometry);
        _renderLeaves(treeBranchGeometrySpec);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setDrawRange(0, index);

      const material = treeMaterial;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.75;
      mesh.updateMatrixWorld();
      return mesh;
    })();
    scene.add(treeMesh);

    this._cleanup = () => {
      scene.add(treeMesh);

      treeMaterial.dispose();
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tree;
