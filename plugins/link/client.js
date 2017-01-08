class Link {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestEngines([
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
            cubeCamera.updateCubeMap(renderer, scene);
          }
        };

        return {
          update: _update,
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

                    [mesh, mesh.cubeCamera].forEach(o => {
                      o.position.set(newValue[0], newValue[1], newValue[2]);
                      o.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
                      o.scale.set(newValue[7], newValue[8], newValue[9]);
                    });

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
