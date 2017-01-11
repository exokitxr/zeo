class Link {
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
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = zeo;

        const meshes = [];
        const _update = () => {
          for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            const {cubeCamera} = mesh;

            mesh.visible = false;
            cubeCamera.updateCubeMap(renderer, scene);
            mesh.visible = true;
          }
        };

        zeo.on('update', _update);

        this._cleanup = () => {
          zeo.removeListener('update', _update);
        };

        return {
          elements: [
            class LinkElement extends HTMLElement {
              static get tag() {
                return 'link';
              }
              static get attributes() {
                return {
                  position: {
                    type: 'matrix',
                    value: [
                      -1, 1, 0,
                      0, 0, 0, 1,
                      1, 1, 1,
                    ],
                  },
                  destination: {
                    type: 'matrix',
                    value: [
                      0, 1, -10,
                      0, 0, 0, 1,
                      1, 1, 1,
                    ],
                  },
                };
              }

              createdCallback() {
                const cubeCamera = new THREE.CubeCamera(0.001, 1024, 256);
                scene.add(cubeCamera);

                const mesh = (() => {
                  const geometry = new THREE.SphereBufferGeometry(0.5, 32, 32);
                  const material = new THREE.MeshLambertMaterial({
                    color: 0xffffff,
                    envMap: cubeCamera.renderTarget.texture,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.cubeCamera = cubeCamera;
                  return mesh;
                })();
                scene.add(mesh);
                meshes.push(mesh);
                this.mesh = mesh;

                this._cleanup = () => {
                  scene.remove(cubeCamera);
                  scene.remove(mesh);

                  meshes.splice(meshes.indexOf(mesh), 1);
                };
              }

              destructor() {
                this._cleanup();
              }

              attributeValueChangedCallback(name, oldValue, newValue) {
                switch (name) {
                  case 'position': {
                    const {mesh} = this;

                    mesh.position.set(newValue[0], newValue[1], newValue[2]);
                    mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
                    mesh.scale.set(newValue[7], newValue[8], newValue[9]);

                    break;
                  }
                  case 'destination': {
                    const {mesh: {cubeCamera}} = this;

                    cubeCamera.position.set(newValue[0], newValue[1], newValue[2]);
                    cubeCamera.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
                    cubeCamera.scale.set(newValue[7], newValue[8], newValue[9]);

                    break;
                  }
                }
              }
            }
          ],
          templates: [
            {
              tag: 'link',
              attributes: {},
              children: [],
            },
          ],
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Link;
