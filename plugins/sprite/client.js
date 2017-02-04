class Sprite {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/zeo',
      '/core/plugins/sprite-utils',
    ]).then(([
      zeo,
      spriteUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        const pixelMaterial = new THREE.MeshPhongMaterial({
          vertexColors: THREE.FaceColors,
          shininess: 0,
        });

        const _requestFileImage = file =>
          file.fetch({
            type: 'blob',
          })
            .then(blob => new Promise((accept, reject) => {
              const url = URL.createObjectURL(blob);
              const img = new Image();
              img.src = url;
              img.onload = () => {
                accept(img);

                URL.revokeObjectURL(url);
              };
              img.onerror = err => {
                reject(err);

                URL.revokeObjectURL(url);
              };
            }));

        class SpriteElement extends HTMLElement {
          static get attributes() {
            return {
              position: {
                type: 'matrix',
                value: [
                  -0.5, 1, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              image: {
                type: 'file',
                value: 'https://cdn.rawgit.com/modulesio/zeo-data/29412380b29e98b18c746a373bdb73aeff59e27a/img/icons/katana.png',
              },
            };
          }

          createdCallback() {
            this.position = null;
            this.mesh = null;

            this._cancelRequest = null;

            this._cleanup = () => {
              const {mesh, _cancelRequest: cancelRequest} = this;
              if (mesh) {
                scene.remove(mesh);
              }
              if (cancelRequest) {
                cancelRequest();
              }
            };
          }

          destructor() {
            this._cleanup();
          }

          attributeValueChangedCallback(name, oldValue, newValue) {
            switch (name) {
              case 'position': {
                this.position = newValue;

                this._updateMesh();

                break;
              }
              case 'image': {
                const file = newValue;

                let live = true;
                this._cancelRequest = () => {
                  live = false;
                };

                _requestFileImage(file)
                  .then(img => {
                    if (live) {
                      const {mesh: oldMesh} = this;
                      if (oldMesh) {
                        scene.remove(oldMesh);
                      }

                      const newMesh = (() => {
                        const geometry = spriteUtils.makeImageGeometry(img, 0.01);
                        const material = pixelMaterial;
                        
                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.castShadow = true;
                        return mesh;
                      })();

                      scene.add(newMesh);
                      this.mesh = newMesh;

                      this._updateMesh();

                      this._cancelRequest = null;
                    }
                  })
                  .catch(err => {
                    console.warn(err);
                  });

                break;
              }
            }
          }

          _updateMesh() {
            const {mesh, position} = this;

            if (mesh && position) {
              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }
          }
        }
        zeo.registerElement(this, SpriteElement);

        this._cleanup = () => {
          zeo.unregisterElement(this);
        };

        return {};
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Sprite;
