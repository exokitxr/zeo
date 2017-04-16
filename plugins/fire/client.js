const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

const SIDES = ['left', 'right'];

class Fire {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestAudio = src => new Promise((accept, reject) => {
      const audio = document.createElement('audio');
      audio.src = src;
      audio.loop = true;
      audio.oncanplaythrough = () => {
        accept(audio);
      };
      audio.onerror = err => {
        reject(err);
      };
    });

    return _requestAudio('archae/fire/audio/fire.ogg')
      .then(audio => {
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

          const oneVector = new THREE.Vector3(1, 1, 1);
          const logGeometry = new THREE.BoxBufferGeometry(0.6, 0.04, 0.04);
          const ashGeometry = new THREEConvexGeometry([
            new THREE.Vector3(-0.2, 0, -0.2),
            new THREE.Vector3(0.2, 0, -0.2),
            new THREE.Vector3(-0.2, 0, 0.2),
            new THREE.Vector3(0.2, 0, 0.2),

            new THREE.Vector3(-0.1, 0.1, -0.1),
            new THREE.Vector3(0.1, 0.1, -0.1),
            new THREE.Vector3(-0.1, 0.1, 0.1),
            new THREE.Vector3(0.1, 0.1, 0.1),
          ]);
          const flameGeometry = new THREEConvexGeometry([
            new THREE.Vector3(-0.1, 0, -0.1),
            new THREE.Vector3(0.1, 0, -0.1),
            new THREE.Vector3(-0.1, 0, 0.1),
            new THREE.Vector3(0.1, 0, 0.1),
            new THREE.Vector3(0, 0.2, 0),
          ]);
          const logMaterial = new THREE.MeshPhongMaterial({
            color: 0x795548,
            shininess: 10,
            shading: THREE.FlatShading,
          });
          const ashMaterial = new THREE.MeshPhongMaterial({
            color: 0x808080,
            shininess: 10,
            shading: THREE.FlatShading,
          });
          const flameMaterial = new THREE.MeshPhongMaterial({
            color: 0xF44336,
            shininess: 10,
            shading: THREE.FlatShading,
            transparent: true,
            opacity: 0.9,
          });
          const sparkMaterial = new THREE.MeshPhongMaterial({
            color: 0xFF5722,
            shininess: 10,
            shading: THREE.FlatShading,
            transparent: true,
            opacity: 0.9,
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
              audio: {
                type: 'checkbox',
                value: true,
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const fireMesh = (() => {
                const result = new THREE.Object3D();

                const logMeshes = [
                  (() => {
                    const geometry = logGeometry.clone();
                    const material = logMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(0.1, 0.2, -0.1);
                    mesh.rotation.y = (Math.PI / 4) + (Math.PI / 2) * 0;
                    mesh.rotation.z = -Math.PI / 4;
                    mesh.rotation.order = camera.rotation.order;
                    return mesh;
                  })(),
                  (() => {
                    const geometry = logGeometry.clone();
                    const material = logMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(-0.1, 0.2, -0.1);
                    mesh.rotation.y = (Math.PI / 4) + (Math.PI / 2) * 1;
                    mesh.rotation.z = -Math.PI / 4;
                    mesh.rotation.order = camera.rotation.order;
                    return mesh;
                  })(),
                  (() => {
                    const geometry = logGeometry.clone();
                    const material = logMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(-0.1, 0.2, 0.1);
                    mesh.rotation.y = (Math.PI / 4) + (Math.PI / 2) * 2;
                    mesh.rotation.z = -Math.PI / 4;
                    mesh.rotation.order = camera.rotation.order;
                    return mesh;
                  })(),
                  (() => {
                    const geometry = logGeometry.clone();
                    const material = logMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(0.1, 0.2, 0.1);
                    mesh.rotation.y = (Math.PI / 4) + (Math.PI / 2) * 3;
                    mesh.rotation.z = -Math.PI / 4;
                    mesh.rotation.order = camera.rotation.order;
                    return mesh;
                  })(),
                ];
                logMeshes.forEach(logMesh => {
                  result.add(logMesh);
                });
                
                const ashMesh = (() => {
                  const geometry = ashGeometry.clone();
                  const material = ashMaterial;
                  const mesh = new THREE.Mesh(geometry, material);
                  return mesh;
                })();
                result.add(ashMesh);

                const flameMeshes = [
                  (() => {
                    const geometry = flameGeometry.clone();
                    const material = flameMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(0, 0, 0);
                    mesh.initialScale = new THREE.Vector3(1, 2, 1);
                    return mesh;
                  })(),
                  (() => {
                    const geometry = flameGeometry.clone();
                    const material = flameMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(-0.1, 0, -0.1);
                    return mesh;
                  })(),
                  (() => {
                    const geometry = flameGeometry.clone();
                    const material = flameMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(0.1, 0, 0.1);
                    return mesh;
                  })(),
                  (() => {
                    const geometry = flameGeometry.clone();
                    const material = flameMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(0.1, 0, -0.1);
                    return mesh;
                  })(),
                  (() => {
                    const geometry = flameGeometry.clone();
                    const material = flameMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(-0.1, 0, 0.1);
                    return mesh;
                  })(),
                ];
                flameMeshes.forEach(flameMesh => {
                  result.add(flameMesh);
                });
                result.flameMeshes = flameMeshes;

                result.destroy = () => {
                  logMeshes.forEach(logMesh => {
                    logMesh.geometry.dispose();
                  });
                  ashMesh.geometry.dispose();
                  flameMeshes.forEach(flameMesh => {
                    flameMesh.geometry.dispose();
                  });
                };

                return result;
              })();
              entityObject.add(fireMesh);

              const soundBody = (() => {
                const result = sound.makeBody();

                const localAudio = audio.cloneNode();
                result.setInputElement(localAudio);
                result.audio = localAudio;

                result.setObject(fireMesh);

                return result;
              })();
              entityApi.soundBody = soundBody;

              const sparkMeshes = [];
              let sparkTimeout = null;
              const _recurseSparks = () => {
                const sparkMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.02);
                  const material = sparkMaterial;

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.x = -0.25 + (Math.random() * 0.5);
                  mesh.position.z = -0.25 + (Math.random() * 0.5);
                  mesh.rotation.y = Math.random() * (Math.PI * 2);
                  mesh.rotation.order = camera.rotation.order;

                  const startWorldTime = world.getWorldTime();
                  mesh.update = () => {
                    const currentWorldTime = world.getWorldTime();
                    const worldTimeDiff = currentWorldTime - startWorldTime;
                    const worldTimeDiffSeconds = worldTimeDiff / 1000;

                    if (worldTimeDiffSeconds < 2) {
                      mesh.position.y += 0.01 * worldTimeDiffSeconds;
                    } else {
                      entityObject.remove(sparkMesh);

                      mesh.destroy();

                      sparkMeshes.splice(sparkMeshes.indexOf(sparkMesh), 1);
                    }
                  };
                  mesh.destroy = () => {
                    geometry.dispose();
                  };

                  return mesh;
                })();
                entityObject.add(sparkMesh);
                sparkMeshes.push(sparkMesh);

                sparkTimeout = setTimeout(_recurseSparks, 100);
              };
              _recurseSparks();

              const _update = () => {
                const _updateSparkMeshes = () => {
                  for (let i = 0; i < sparkMeshes.length; i++) {
                    const sparkMesh = sparkMeshes[i];
                    sparkMesh.update();
                  }
                };
                const _updateFlameMeshes = () => {
                  const {flameMeshes} = fireMesh;
                  const animationTime = 1000;
                  const flameMin = 0.55;
                  const flameMax = 1;

                  const worldTime = world.getWorldTime();

                  const _animateFlameMesh = (flameMesh, frameOffsetFactor) => {
                    const {initialScale = oneVector} = flameMesh;

                    flameMesh.scale.copy(initialScale);
                    flameMesh.scale.y *= flameMin +
                      ((Math.sin((((worldTime % animationTime) / animationTime) + frameOffsetFactor) * (Math.PI * 2)) + 1) / 2) * (flameMax - flameMin);
                  };

                  const rootFlameMesh = flameMeshes[0];
                  _animateFlameMesh(rootFlameMesh, 0);

                  for (let i = 1; i < flameMeshes.length; i++) {
                    const flameMesh = flameMeshes[i];
                    _animateFlameMesh(flameMesh, i / 5);
                  }
                };

                _updateSparkMeshes();
                _updateFlameMeshes();
              };
              render.on('update', _update);

              entityApi._cleanup = () => {
                entityObject.remove(fireMesh);
                fireMesh.destroy();

                const {audio} = soundBody;
                if (!audio.paused) {
                  audio.pause();
                }

                for (let i = 0; i < sparkMeshes.length; i++) {
                  const sparkMesh = sparkMeshes[i];
                  entityObject.remove(sparkMesh);
                  sparkMesh.destroy();
                }
                clearTimeout(sparkTimeout);

                render.removeListener('update', _update);
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
                case 'audio': {
                  const {soundBody} = entityApi;
                  const {audio} = soundBody;

                  if (newValue && audio.paused) {
                    audio.currentTime = 0;
                    audio.play();
                  } else if (!newValue && !audio.paused) {
                    audio.pause();
                  }

                  break;
                }
              }
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
          };
          elements.registerComponent(this, fireComponent);

          this._cleanup = () => {
            logGeometry.dispose();
            ashGeometry.dispose();
            flameGeometry.dispose();
            logMaterial.dispose();
            ashMaterial.dispose();
            flameMaterial.dispose();
            sparkMaterial.dispose();

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
