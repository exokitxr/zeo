const AUDIO_FILES = [
  // 'fire.ogg',
];
const SIDES = ['left', 'right'];

class Fire {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestAudios = () => Promise.all(AUDIO_FILES.map(fileName => new Promise((accept, reject) => {
      const audio = document.createElement('audio');
      audio.src = '/archae/egg/audio/' + fileName;
      audio.oncanplaythrough = () => {
        accept(audio);
      };
      audio.onerror = err => {
        reject(err);
      };
    })));

    return _requestAudios()
      .then(audios => {
        if (live) {
          const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

          const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
          const _decomposeMatrix = matrix => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const logMaterial = new THREE.MeshPhongMaterial({
            color: 0x795548,
            shininess: 10,
            shading: THREE.FlatShading,
          });

          const fireComponent = {
            selector: 'fire[position]',
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

              const fireMesh = (() => {
                const result = new THREE.Object3D();

                const logGeometry = new THREE.BoxBufferGeometry(0.1, 0.025, 0.025)
                  // .applyMatrix(new THREE.Matrix4().makeRotationZ(-Math.PI / 2))
                  // .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.1, 0));

                const logMeshes = [
                  (() => {
                    const geometry = logGeometry.clone();
                    const material = logMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.x = 0.1;
                    mesh.position.z = -0.1;
                    mesh.rotation.y = (Math.PI / 4) + (Math.PI / 2) * 0;
                    mesh.rotation.z = -Math.PI / 2;
                    mesh.rotation.order = camera.rotation.order;
                    return mesh;
                  })(),
                  (() => {
                    const geometry = logGeometry.clone();
                    const material = logMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.x = -0.1;
                    mesh.position.z = -0.1;
                    mesh.rotation.y = (Math.PI / 4) + (Math.PI / 2) * 1;
                    mesh.rotation.z = -Math.PI / 2;
                    mesh.rotation.order = camera.rotation.order;
                    return mesh;
                  })(),
                  (() => {
                    const geometry = logGeometry.clone();
                    const material = logMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.x = -0.1;
                    mesh.position.z = 0.1;
                    mesh.rotation.y = (Math.PI / 4) + (Math.PI / 2) * 2;
                    mesh.rotation.z = -Math.PI / 2;
                    mesh.rotation.order = camera.rotation.order;
                    return mesh;
                  })(),
                  (() => {
                    const geometry = logGeometry.clone();
                    const material = logMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.x = 0.1;
                    mesh.position.z = 0.1;
                    mesh.rotation.y = (Math.PI / 4) + (Math.PI / 2) * 3;
                    mesh.rotation.z = -Math.PI / 2;
                    mesh.rotation.order = camera.rotation.order;
                    return mesh;
                  })(),
                ];
                logMeshes.forEach(logMesh => {
                  result.add(logMesh);
                });

                return result;
              })();
              entityObject.add(fireMesh);

              /* const soundBody = (() => {
                const result = sound.makeBody();
                result.setInputElements(audios);
                result.setObject(head);
                return result;
              })(); */

              entityApi._cleanup = () => {
                entityObject.remove(fireMesh);
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
          elements.registerComponent(this, fireComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, fireComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Fire;
