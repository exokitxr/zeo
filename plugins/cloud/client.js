const indev = require('indev');

const CLOUD_RATE = 0.00001;
const CLOUD_SPEED = 2;

const NUM_CELLS = 64;

class Cloud {
  mount() {
    return;
    const {three: {THREE, camera}, elements, render, world, utils: {geometry: geometryUtils, random: {alea}}} = zeo;

    const cloudsMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      opacity: 0.5,
      transparent: true,
      fog: false,
    });

    const cloudTypes = [
      geometryUtils.unindexBufferGeometry(new THREE.TetrahedronBufferGeometry(1, 1)),
      geometryUtils.unindexBufferGeometry(new THREE.BoxBufferGeometry(1, 1, 1)),
    ];

    const updates = [];

    const cloudEntity = {
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

        const rng = new alea();
        const generator = indev({
          random: rng,
        });
        const cloudNoise = generator.simplex({
          frequency: 5000,
          octaves: 1,
        });

        const cloudsMesh = (() => {
          const result = new THREE.Object3D();
          result.cloudMeshes = [];
          return result;
        })();
        entityObject.add(cloudsMesh);
        entityApi.cloudsMesh = cloudsMesh;

        const _getWorldTime = () => world.getWorldTime();

        let lastFrameTime = _getWorldTime();
        let lastMeshTime = _getWorldTime();
        const update = () => {
          const _setCloudMeshFrame = worldTime => {
            const {cloudMeshes} = cloudsMesh;

            for (let i = 0; i < cloudMeshes.length; i++) {
              const cloudMesh = cloudMeshes[i];
              const {basePosition, startTime} = cloudMesh;
              const timeDiff = worldTime - startTime;
              cloudMesh.position.x = basePosition[0] - ((timeDiff / 1000) * CLOUD_SPEED);
              cloudMesh.updateMatrixWorld();
            }
          };
          const _setCloudMesh = worldTime => {
            const clouds = (() => {
              const result = [];

              for (let y = -NUM_CELLS; y < NUM_CELLS; y++) {
                for (let x = -NUM_CELLS; x < NUM_CELLS; x++) {
                  const ax = x + Math.floor((worldTime / 1000) * CLOUD_SPEED);
                  const ay = y;
                  const cloudNoiseN = cloudNoise.in2D(ax, ay);
                  if (cloudNoiseN < CLOUD_RATE) {
                    const basePosition = [x, y];
                    const cloudId = ax + ':' + ay;
                    result.push({
                      basePosition,
                      cloudId,
                    });
                  }
                }
              }

              return result;
            })();

            const {cloudMeshes} = cloudsMesh;
            const addedClouds = clouds.filter(cloud => !cloudMeshes.some(cloudMesh => cloudMesh.cloudId === cloud.cloudId));
            const removedCloudMeshes = cloudMeshes.filter(cloudMesh => !clouds.some(cloud => cloud.cloudId === cloudMesh.cloudId));

            for (let i = 0; i < removedCloudMeshes.length; i++) {
              const cloudMesh = removedCloudMeshes[i];

              cloudsMesh.remove(cloudMesh);
              cloudMesh.destroy();
            }
            const newCloudMeshes = cloudMeshes.filter(cloudMesh => !removedCloudMeshes.some(removedCloudMesh => removedCloudMesh === cloudMesh));

            addedClouds.forEach(cloud => {
              const {basePosition, cloudId} = cloud;

              const cloudMesh = (() => {
                const cloudRng = new alea(cloudId);
                const numCloudMeshChunks = 5 + Math.floor(cloudRng() * 40);
                const cloudMeshChunks = Array(numCloudMeshChunks);
                const points = [];
                for (let j = 0; j < numCloudMeshChunks; j++) {
                  const cloudType = cloudTypes[Math.floor(cloudTypes.length * cloudRng())];
                  const geometry = cloudType.clone()
                    .applyMatrix(new THREE.Matrix4().makeScale(
                      1 + (cloudRng() * 8),
                      1 + (cloudRng() * 8),
                      1 + (cloudRng() * 8)
                    ))
                    .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(
                      new THREE.Euler(
                        cloudRng() * Math.PI * 2,
                        cloudRng() * Math.PI * 2,
                        cloudRng() * Math.PI * 2,
                        camera.rotation.euler
                      )
                    ))
                    .applyMatrix(new THREE.Matrix4().makeTranslation(
                      -25 + (cloudRng() * 25),
                      -5 + (cloudRng() * 5),
                      -25 + (cloudRng() * 25)
                    ));
                  points.push(geometry.getAttribute('position').array);
                }
                const geometry = new THREE.BufferGeometry();
                const positions = (() => {
                  const size = (() => {
                    let result = 0;
                    for (let i = 0; i < points.length; i++) {
                      const point = points[i];
                      result += point.length;
                    }
                    return result;
                  })();
                  const result = new Float32Array(size);
                  let index = 0;
                  for (let i = 0; i < points.length; i++) {
                    const point = points[i];
                    result.set(point, index);
                    index += point.length;
                  }
                  return result;
                })();
                geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));

                const material = cloudsMaterial;

                const cloudMesh = new THREE.Mesh(geometry, material);
                cloudMesh.position.x = basePosition[0];
                cloudMesh.position.y = 30 + (cloudRng() * 10);
                cloudMesh.position.z = basePosition[1];
                cloudMesh.updateMatrixWorld();
                cloudMesh.frustumCulled = false;

                cloudMesh.cloudId = cloudId;
                cloudMesh.basePosition = basePosition;
                cloudMesh.startTime = worldTime;

                cloudMesh.destroy = () => {
                  geometry.dispose();
                };

                return cloudMesh;
              })();

              cloudsMesh.add(cloudMesh);
              newCloudMeshes.push(cloudMesh);
            });

            cloudsMesh.cloudMeshes = newCloudMeshes;
          };

          const nextWorldTime = _getWorldTime();

          const frameTimeDiff = nextWorldTime - lastFrameTime;
          if (frameTimeDiff >= 20) {
            _setCloudMeshFrame(nextWorldTime);
            lastFrameTime = nextWorldTime;
          }
          const meshTimeDiff = nextWorldTime - lastMeshTime;
          if (meshTimeDiff >= 1000) {
            _setCloudMesh(nextWorldTime);
            lastMeshTime = nextWorldTime;
          }
        };
        updates.push(update);

        entityApi._cleanup = () => {
          entityObject.remove(cloudsMesh);

          updates.splice(updates.indexOf(update), 1);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getEntityApi();

        switch (name) {
          case 'position': {
            const {cloudsMesh} = entityApi;

            cloudsMesh.position.set(newValue[0], newValue[1], newValue[2]);
            cloudsMesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            cloudsMesh.scale.set(newValue[7], newValue[8], newValue[9]);

            break;
          }
        }
      },
    };
    elements.registerEntity(this, cloudEntity);

    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        update();
      }
    };
    render.on('update', _update);

    this._cleanup = () => {
      cloudsMaterial.dispose();

      elements.unregisterEntity(this, cloudEntity);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Cloud;
