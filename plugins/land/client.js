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
    const worker = new Worker('archae/plugins/land/build/worker.js');
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
          const {positions, normals} = result;

          const geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));

          accept(geometry);
        } else {
          reject(err);
        }
      });
    });

    return _requestHeightmap()
      .then(landGeometry => {
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

        const landEntity = {
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

            const landMesh = (() => {
              const geometry = landGeometry.clone();
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
            const entityApi = entityElement.getEntityApi();

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
            const entityApi = entityElement.getEntityApi();

            entityApi._cleanup();
          },
        };
        elements.registerEntity(this, landEntity);

        this._cleanup = () => {
          elements.unregisterEntity(this, landEntity);
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
