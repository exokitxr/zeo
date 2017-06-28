const NUM_POSITIONS = 10 * 1024;

class Tree {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, utils: {geometry: geometryUtils}} = zeo;
    const {THREE, scene, camera} = three;

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
        const radiusBottom = 0.2 + Math.random() * 0.3;
        const radiusTop = radiusBottom * (0.2 + (Math.random() * 0.3));
        const heightSegments = 10;
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
          const c = baseColor.clone().multiplyScalar(0.1 + (((y + 1) / heightSegments) * 0.9));

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
        const c = baseColor.clone().multiplyScalar(0.5 + (((y + 1) / heightSegments) * (1 - 0.5)));

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
      _makeTreeBranchGeometries(2),
      _makeTreeBranchGeometries(3),
      _makeTreeBranchGeometries(4),
      _makeTreeBranchGeometries(5),
      _makeTreeBranchGeometries(6),
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
        const _renderBranches = treeCoreGeometry => {
          const {heightSegments, heightOffsets} = treeCoreGeometry;

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
                const newNormals = geometry.getAttribute('normal').array;
                const newColors = geometry.getAttribute('color').array;
                positions.set(newPositions, index);
                normals.set(newNormals, index);
                colors.set(newColors, index);

                index += newPositions.length;
              }
            }
          }
        };

        const treeCoreGeometry = _renderCore();
        _renderBranches(treeCoreGeometry);
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
