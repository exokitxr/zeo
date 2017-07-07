const FACES = ['back', 'left', 'front', 'right', 'top', 'bottom'];
const DEFAULT_MATRIX = [
  0, 1, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

class Skybox {
  mount() {
    const {three: {THREE, scene}, elements, ui} = zeo;

    const transparentImg = ui.getTransparentImg();

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
    const _requestCubeMapImgs = type => Promise.all(FACES.map((face, index) => _requestImage('archae/skybox/img/skybox-' + type + '-' + (index + 1) + '.png')))
      .then(cubeMapImgs => {
        const result = {};
        for (let i = 0; i < cubeMapImgs.length; i++) {
          const cubeMapImg = cubeMapImgs[i];
          const face = FACES[i];
          result[face] = cubeMapImg;
        }
        return result;
      });

    const skyboxEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: DEFAULT_MATRIX,
        },
        type: {
          type: 'select',
          value: 'dark',
          options: [
            'dark',
            'light',
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        const skyboxMesh = (() => {
          const geometry = new THREE.BoxBufferGeometry(10000, 10000, 10000)
            .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));

          const _makeMaterial = () => {
            const texture = new THREE.Texture(
              transparentImg,
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
              fog: false,
            });
            return material;
          };
          const materials = (() => {
            const result = Array(6);
            for (let i = 0; i < result.length; i++) {
              result[i] = _makeMaterial();
            }
            return result;
          })();

          const mesh = new THREE.Mesh(geometry, materials);
          mesh.frustumCulled = false;
          return mesh;
        })();
        entityObject.add(skyboxMesh);

        entityApi.type = 'dark';
        entityApi.render = () => {
          const {type} = entityApi;

          _requestCubeMapImgs(type)
            .then(cubeMapImgs => {
              const {material: materials} = skyboxMesh;

              const skyboxImgs = [
                'right',
                'left',
                'top',
                'bottom',
                'front',
                'back',
              ].map(face => cubeMapImgs[face]);
              for (let i = 0; i < skyboxImgs.length; i++) {
                const skyboxImg = skyboxImgs[i];
                const material = materials[i];
                const {map: texture} = material;
                texture.image = skyboxImg;
                texture.needsUpdate = true;
              }
            })
            .catch(err => {
              console.warn(err);
            });
        };

        entityApi._cleanup = () => {
          entityObject.remove(skyboxMesh);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getEntityApi();
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
          case 'type': {
            entityApi.type = newValue;

            entityApi.render();

            break;
          }
        }
      }
    };
    elements.registerEntity(this, skyboxEntity);

    this._cleanup = () => {
      elements.registerEntity(this, skyboxEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Skybox;
