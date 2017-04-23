const FACES = ['back', 'left', 'front', 'right', 'top', 'bottom'];
const DEFAULT_MATRIX = [
  0, 1, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

class Skybox {
  mount() {
    const {three: {THREE, scene}, elements} = zeo;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });
    const _requestCubeMapImgs = () => Promise.all(FACES.map((face, index) => _requestImage('archae/skybox/img/skybox-' + (index + 1) + '.png')))
      .then(cubeMapImgs => {
        const result = {};
        for (let i = 0; i < cubeMapImgs.length; i++) {
          const cubeMapImg = cubeMapImgs[i];
          const face = FACES[i];
          result[face] = cubeMapImg;
        }
        return result;
      });

    return _requestCubeMapImgs()
      .then(cubeMapImgs => {
        if (live) {
          const skyboxComponent = {
            selector: 'skybox[position]',
            attributes: {
              position: {
                type: 'matrix',
                value: DEFAULT_MATRIX,
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const skyboxMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(10000, 10000, 10000)
                  .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));

                const skyboxImgs = [
                  'right',
                  'left',
                  'top',
                  'bottom',
                  'front',
                  'back',
                ].map(face => cubeMapImgs[face]);
                const materials = skyboxImgs.map(skyboxImg => {
                  const texture = new THREE.Texture(
                    skyboxImg,
                    THREE.UVMapping,
                    THREE.ClampToEdgeWrapping,
                    THREE.ClampToEdgeWrapping,
                    THREE.NearestFilter,
                    THREE.NearestFilter,
                    THREE.RGBAFormat,
                    THREE.UnsignedByteType,
                    1
                  );
                  texture.needsUpdate = true;

                  const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    color: 0xFFFFFF,
                    side: THREE.BackSide,
                  });
                  return  material;
                });

                const mesh = new THREE.Mesh(geometry, materials);
                return mesh;
              })();
              entityObject.add(skyboxMesh);

              entityApi._cleanup = () => {
                entityObject.remove(skyboxMesh);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityObject = entityElement.getObject();

              switch (name) {
                case 'position': {
                  const position = newValue;

                  if (position) {
                    entityObject.position.set(position[0], position[1], position[2]);
                    entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                    entityObject.scale.set(position[7], position[8], position[9]);
                  }

                  break;
                }
              }
            }
          };
          elements.registerComponent(this, skyboxComponent);

          this._cleanup = () => {
            elements.registerComponent(this, skyboxComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Skybox;
