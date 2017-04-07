const size = 32;
const resolution = 2;

class Land {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils, random: randomUtils}} = zeo;
    const {alea} = randomUtils;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const callbacks = new Map();
    const worker = new Worker('/archae/plugins/land/build/worker.js');
    worker.onmessage = e => {
      const {data} = e;
      const {id, error, result} = data;

      const callback = callbacks.get(id);
      callback(error, result);
      callbacks.delete(id);
    };
    const _requestHeightmap = () => new Promise((accept, reject) => {
      const id = _makeId();
      worker.postMessage({
        id: id,
        method: 'generate',
        args: [
          0.1,
          8,
          size,
          resolution,
        ],
      });
      callbacks.set(id, (err, result) => {
        if (!err) {
          const array = new Float32Array(result);
          accept(array);
        } else {
          reject(err);
        }
      });
    });

    return _requestHeightmap()
      .then(heightmap => {
        if (live) {
        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

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
                  const ax = positions[baseIndex + 0] + (size / 2);
                  const ay = positions[baseIndex + 2] + (size / 2);
                  const x = Math.floor(ax);
                  const y = Math.floor(ay);
                  const xr = Math.floor(ax / 0.5) % 2;
                  const yr = Math.floor(ay / 0.5) % 2;
                  positions[baseIndex + 1] = -0.25 + (heightmap[((y * (size * resolution * resolution))) + (yr * (size * resolution)) + (x * resolution) + xr] * 0.5);
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
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Land;
