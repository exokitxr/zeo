const indev = require('indev');

const DEFAULT_SEED = 'zeo';

class Land {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils, random: randomUtils}} = zeo;
    const {alea} = randomUtils;

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const rng = new alea(DEFAULT_SEED);
    const generator = indev({
      random: rng,
    });
    const heightmapNoise = generator.uniform({
      frequency: 0.1,
      octaves: 8,
    });
    const landMaterial = new THREE.MeshPhongMaterial({
      color: 0x8BC34A,
      shininess: 10,
      shading: THREE.FlatShading,
    });

    const landComponent = {
      selector: 'land[position]',
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
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const landMesh = (() => {
          const geometry = (() => {
            const size = 32;
            const geometry = geometryUtils.unindexBufferGeometry(
              new THREE.PlaneBufferGeometry(size, size, size * 2, size * 2)
                .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
            );

            const positionsAttribute = geometry.getAttribute('position');
            const {array: positions} = positionsAttribute;
            const numPoints = positions.length / 3;
            for (let i = 0; i < numPoints; i++) {
              const baseIndex = i * 3;
              const x = positions[baseIndex + 0];
              const y = positions[baseIndex + 2];
              positions[baseIndex + 1] = -0.25 + (heightmapNoise.in2D(x, y) * 0.5);
            }
            positionsAttribute.needsUpdate = true;

            return geometry;
          })();
          const material = landMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          return mesh;
        })();
        entityObject.add(landMesh);

        entityApi._cleanup = () => {
          entityObject.remove(landMesh);
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          /* case 'position': { // XXX re-enable this
            const position = newValue;

            if (position) {
              const {mesh} = entityApi;

              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }

            break;
          } */
        }
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
    };
    elements.registerComponent(this, landComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, landComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Land;
