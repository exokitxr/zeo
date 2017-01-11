class Camera {
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

        const updates = [];
        const _update = () => {
          for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            update();
          }
        };

        zeo.on('update', _update);

        this._cleanup = () => {
          zeo.removeListener('update', _update);
        };

        return {
          elements: [
            class CameraElement extends HTMLElement {
              static get tag() {
                return 'camera';
              }
              static get attributes() {
                return {
                  position: {
                    type: 'matrix',
                    value: [
                      0, 0, 0,
                      0, 0, 0, 1,
                      1, 1, 1,
                    ],
                  },
                };
              }

              createdCallback() {
                const renderTarget = (() => {
                  const rendererSize = renderer.getSize();
                  const rendererPixelRatio = renderer.getPixelRatio();
                  const renderPixelFactor = 0.05;
                  const resolutionWidth = rendererSize.width * rendererPixelRatio * renderPixelFactor;
                  const resolutionHeight = rendererSize.height * rendererPixelRatio * renderPixelFactor;
                  const renderTarget = new THREE.WebGLRenderTarget(resolutionWidth, resolutionHeight, {
                    minFilter: THREE.NearestFilter,
                    magFilter: THREE.NearestFilter,
                    format: THREE.RGBAFormat,
                  });
                  return renderTarget;
                })();

                const cameraWidth = 0.2;
                const cameraHeight = 0.15;
                const cameraDepth = 0.1;

                const mesh = (() => {
                  const result = new THREE.Object3D();

                  const wireframeMaterial = new THREE.MeshBasicMaterial({
                    color: 0x000000,
                    wireframe: true,
                    opacity: 0.5,
                    transparent: true,
                  });

                  const baseMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(cameraWidth, cameraHeight, cameraDepth);

                    const material = wireframeMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    return mesh;
                  })();
                  result.add(baseMesh);
                  result.baseMesh = baseMesh;

                  const lensMesh = (() => {
                    const lensWidth = cameraWidth * 0.4;
                    const lensHeight = lensWidth;
                    const lensDepth = lensWidth;

                    const geometry = (() => {
                      const result = new THREE.BoxBufferGeometry(lensWidth, lensHeight, lensDepth);
                      result.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(cameraDepth / 2) - (lensDepth / 2)));
                      return result;
                    })();

                    const material = wireframeMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    return mesh;
                  })();
                  result.add(lensMesh);
                  result.lensMesh = lensMesh;

                  const screenMesh = (() => {
                    const screenWidth = cameraWidth;
                    const screenHeight = cameraHeight;
                    const geometry = (() => {
                      const result = new THREE.PlaneBufferGeometry(screenWidth, screenHeight);
                      result.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, cameraDepth / 2));
                      return result;
                    })();
                    const material = (() => {
                      const result = new THREE.MeshBasicMaterial({
                        map: renderTarget.texture,
                      });
                      result.polygonOffset = true;
                      result.polygonOffsetFactor = -1;
                      return result;
                    })();
                    const mesh = new THREE.Mesh(geometry, material);
                    return mesh;
                  })();
                  result.add(screenMesh);
                  result.screenMesh = screenMesh;

                  return result;
                })();
                scene.add(mesh);
                this.mesh = mesh;

                const sourceCamera = new THREE.PerspectiveCamera(45, cameraWidth / cameraHeight, camera.near, camera.far);

                const update = () => {
                  const lensPosition = new THREE.Vector3();
                  const lensRotation = new THREE.Quaternion();
                  const lensScale = new THREE.Vector3();
                  mesh.lensMesh.updateMatrixWorld();
                  mesh.lensMesh.matrixWorld.decompose(lensPosition, lensRotation, lensScale);

                  sourceCamera.position.copy(lensPosition);
                  sourceCamera.quaternion.copy(lensRotation);

                  mesh.visible = false;
                  renderer.render(scene, sourceCamera, renderTarget);
                  renderer.setRenderTarget(null);
                  mesh.visible = true;
                };
                updates.push(update);

                this._cleanup = () => {
                  scene.remove(mesh);

                  updates.splice(updates.indexOf(update), 1);
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
                }
              }
            }
          ],
          templates: [
            {
              tag: 'camera',
              attributes: {
                position: (() => {
                  const position = new THREE.Vector3(-0.5, 1.5, 0.5);
                  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI * (3 / 4), 0));
                  const scale = new THREE.Vector3(1, 1, 1);
                  return position.toArray().concat(rotation.toArray()).concat(scale.toArray());
                })(),
              },
              children: [],
            },
          ],
        }
      }
    });
  }
}

module.exports = Camera;
