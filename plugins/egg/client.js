const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

const AUDIO_FILES = [
  // 'eat.ogg',
];
const SIDES = ['left', 'right'];

class Egg {
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

          const THREEConvexGeometry = ConvexGeometry(THREE);

          const eggGeometry = (() => {
            const points = [
              new THREE.Vector3(-0.1, 0.05, -0.1),
              new THREE.Vector3(0.1, 0.05, -0.1),
              new THREE.Vector3(-0.1, 0.05, 0.1),
              new THREE.Vector3(0.1, 0.05, 0.1),

              new THREE.Vector3(-0.1, -0.05, -0.1),
              new THREE.Vector3(0.1, -0.05, -0.1),
              new THREE.Vector3(-0.1, -0.05, 0.1),
              new THREE.Vector3(0.1, -0.05, 0.1),

              new THREE.Vector3(-0.05, 0.175, -0.05),
              new THREE.Vector3(0.05, 0.175, -0.05),
              new THREE.Vector3(-0.05, 0.175, 0.05),
              new THREE.Vector3(0.05, 0.175, 0.05),

              new THREE.Vector3(-0.05, -0.125, -0.05),
              new THREE.Vector3(0.05, -0.125, -0.05),
              new THREE.Vector3(-0.05, -0.125, 0.05),
              new THREE.Vector3(0.05, -0.125, 0.05),
            ];
            return new THREEConvexGeometry(points);
          })();
          const solidMaterial = new THREE.MeshPhongMaterial({
            color: 0x808080,
            shininess: 10,
            shading: THREE.FlatShading,
          });

          const eggComponent = {
            selector: 'egg[position]',
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

              const mesh = (() => {
                const geometry = eggGeometry.clone();
                const material = solidMaterial;
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 1;
                return mesh;
              })();
              entityObject.add(mesh);
              entityApi.mesh = mesh;

              /* const soundBody = (() => {
                const result = sound.makeBody();
                result.setInputElements(audios);
                result.setObject(head);
                return result;
              })(); */

              entityApi._cleanup = () => {
                entityObject.remove(mesh);
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
          elements.registerComponent(this, eggComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, eggComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Egg;
