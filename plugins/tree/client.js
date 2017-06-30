const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 2 * 1000 * 1000;

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

    const treeMaterial = new THREE.MeshBasicMaterial({
      // color: 0xFFFFFF,
      // shininess: 0,
      // shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      side: THREE.DoubleSide,
    });

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _resArrayBuffer = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.arrayBuffer();
      } else {
        const err = new Error('invalid status code: ' + res.status);
        return Promise.reject(err);
      }
    };
    const _requestTreeTemplates = () => fetch('archae/tree/templates')
      .then(_resArrayBuffer)
      .then(treeTemplatesBuffer => protocolUtils.parseTreeGeometry(treeTemplatesBuffer))
      .then(treeTemplateSpec => {
        const {positions, /*normals, */colors, indices} = treeTemplateSpec;

        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        // geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        return geometry;
      });
    const _requestTreeGenerate = (x, y) => fetch(`archae/tree/generate?x=${x}&y=${y}`)
      .then(_resArrayBuffer)
      .then(treePostionsBuffer => {
        return new Float32Array(treePostionsBuffer);
      });
    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };

    return Promise.all([
      _requestTreeTemplates(),
      _requestTreeGenerate(0, 0),
    ])
      .then(([
        treeGeometry,
        treePositions,
      ]) => {
        if (live) {
          const treeMesh = (() => {
            const positions = new Float32Array(NUM_POSITIONS * 3);
            // const normals = new Float32Array(NUM_POSITIONS * 3);
            const colors = new Float32Array(NUM_POSITIONS * 3);
            const indices = new Uint32Array(NUM_POSITIONS * 3);
            let attributeIndex = 0;
            let indexIndex = 0;

            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3(1, 1, 1);
            const matrix = new THREE.Matrix4();

            const numTreePositions = treePositions.length / 3;
            for (let i = 0; i < numTreePositions; i++) {
              const baseIndex = i * 3;
              position.set(
                treePositions[baseIndex + 0],
                treePositions[baseIndex + 1],
                treePositions[baseIndex + 2]
              );
              quaternion.setFromAxisAngle(upVector, Math.random() * Math.PI * 2);
              matrix.compose(position, quaternion, scale);
              const geometry = treeGeometry
                .clone()
                .applyMatrix(matrix);
              const newPositions = geometry.getAttribute('position').array;
              positions.set(newPositions, attributeIndex);
              /* const newNormals = geometry.getAttribute('normal').array;
              normals.set(newNormals, attributeIndex); */
              const newColors = geometry.getAttribute('color').array;
              colors.set(newColors, attributeIndex);
              const newIndices = geometry.index.array;
              _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

              attributeIndex += newPositions.length;
              indexIndex += newIndices.length;
            }
            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
            // geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals.buffer, normals.byteOffset, attributeIndex), 3));
            geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, attributeIndex), 3));
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices.buffer, indices.byteOffset, indexIndex), 1));

            const material = treeMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            // mesh.frustumCulled = false;
            return mesh;
          })();
          scene.add(treeMesh);

          this._cleanup = () => {
            scene.remove(treeMesh);

            treeMaterial.dispose();
          };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tree;
