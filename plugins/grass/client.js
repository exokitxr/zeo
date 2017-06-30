const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS = 2000 * 1000;

class Grass {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose} = zeo;
    const {THREE, scene, camera} = three;

    const upVector = new THREE.Vector3(0, 1, 0);

    const grassMaterial = new THREE.MeshBasicMaterial({
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

    const _requestGrassTemplates = () => fetch('archae/grass/templates')
      .then(res => {
        if (res.status >= 200 && res.status < 300) {
          return res.arrayBuffer()
            .then(grassTemplatesBuffer => protocolUtils.parseGrassGeometry(grassTemplatesBuffer))
            .then(grassTemplateSpec => {
              const {positions, colors} = grassTemplateSpec;

              const geometry = new THREE.BufferGeometry();
              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
              return geometry;
            });
        } else {
          const err = new Error('invalid status code: ' + res.status);
          return Promise.reject(err);
        }
      });
    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };

    return _requestGrassTemplates()
      .then(grassGeometry => {
        if (live) {
          const grassMesh = (() => {
            const positions = new Float32Array(NUM_POSITIONS * 3);
            const colors = new Float32Array(NUM_POSITIONS * 3);
            let attributeIndex = 0;

            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3(1, 1, 1);
            const matrix = new THREE.Matrix4();

            const numPatches = 200;
            for (let i = 0; i < numPatches; i++) {
              const patchPosition = new THREE.Vector3(
                -50 + (Math.random() * 100),
                0,
                -50 + (Math.random() * 100)
              );

              position.set(patchPosition.x + (-1 + (Math.random() * 1)), 0, patchPosition.z + (-1 + (Math.random() * 1)));
              quaternion.setFromAxisAngle(upVector, Math.random() * Math.PI * 2);
              // scale.set(1 + Math.random() * 2, 2 + Math.random() * 6, 1 + Math.random() * 2);
              matrix.compose(position, quaternion, scale);
              const geometry = grassGeometry
                .clone()
                .applyMatrix(matrix);
              const newPositions = geometry.getAttribute('position').array;
              positions.set(newPositions, attributeIndex);
              const newColors = geometry.getAttribute('color').array;
              colors.set(newColors, attributeIndex);

              attributeIndex += newPositions.length;
            }
            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
            geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, attributeIndex), 3));

            const material = grassMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            // mesh.position.y = 0.5;
            // mesh.updateMatrixWorld();
            // mesh.frustumCulled = false;
            mesh.drawMode = THREE.TriangleStripDrawMode;
            return mesh;
          })();
          scene.add(grassMesh);

          this._cleanup = () => {
            scene.remove(grassMesh);

            grassMaterial.dispose();
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Grass;
