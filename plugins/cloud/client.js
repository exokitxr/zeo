const Alea = require('alea');
const indev = require('indev');

const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

const DEFAULT_SEED = 'zeo';

const CLOUD_RATE = 0.00001;
const CLOUD_SPEED = 2;

const NUM_CELLS = 64;

class Cloud {
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
      '/core/engines/rend',
      '/core/engines/cyborg',
    ]).then(([
      zeo,
      rend,
      cyborg,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = zeo;
        const THREEConvexGeometry = ConvexGeometry(THREE);

        const world = rend.getCurrentWorld();

        const cloudsMaterial = new THREE.MeshBasicMaterial({
          color: 0xFFFFFF,
          opacity: 0.5,
          transparent: true,
          fog: false,
        });

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
            class CloudElement extends HTMLElement {
              static get tag() {
                return 'cloud';
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
                const rng = new Alea();
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
                scene.add(cloudsMesh);
                this.cloudsMesh = cloudsMesh;

                const _getWorldTime = () => world.getWorldTime();
                const _getPosition = () => {
                  const player = cyborg.getPlayer();
                  const status = player.getStatus();
                  return status.hmd.position;
                };

                let lastWorldTime = _getWorldTime();
                let lastPosition = _getPosition();
                const update = () => {
                  const _getSnappedWorldTime = worldTime => Math.floor(worldTime / 1000) * 1000;
                  const _getSnappedPosition = position => new THREE.Vector3(
                    Math.floor(position.x / 8) * 8,
                    Math.floor(position.y / 8) * 8,
                    Math.floor(position.z / 8) * 8
                  );

                  const _setCloudMeshFrame = worldTime => {
                    const {cloudMeshes} = cloudsMesh;

                    cloudMeshes.forEach(cloudMesh => {
                      const {basePosition, startTime} = cloudMesh;
                      const timeDiff = worldTime - startTime;
                      cloudMesh.position.x = basePosition[0] - ((timeDiff / 1000) * CLOUD_SPEED);
                    });
                  };
                  const _setCloudMesh = (position, worldTime) => {
                    const clouds = (() => {
                      const result = [];

                      for (let y = -NUM_CELLS; y < NUM_CELLS; y++) {
                        for (let x = -NUM_CELLS; x < NUM_CELLS; x++) {
                          const bx = position.x + x;
                          const by = position.y + y;
                          const ax = bx + Math.floor((worldTime / 1000) * CLOUD_SPEED);
                          const ay = by;
                          const cloudNoiseN = cloudNoise.in2D(ax, ay);
                          if (cloudNoiseN < CLOUD_RATE) {
                            const basePosition = [bx, by];
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

                    removedCloudMeshes.forEach(cloudMesh => {
                      cloudsMesh.remove(cloudMesh);
                    });
                    const newCloudMeshes = cloudMeshes.filter(cloudMesh => !removedCloudMeshes.some(removedCloudMesh => removedCloudMesh === cloudMesh));

                    addedClouds.forEach(cloud => {
                      const {basePosition, cloudId} = cloud;

                      const cloudMesh = (() => {
                        const result = new THREE.Object3D();

                        const cloudRng = new Alea(cloudId);
                        const numCloudMeshChunks = 2 + Math.floor(cloudRng() * 8);
                        for (let j = 0; j < numCloudMeshChunks; j++) {
                          const geometry = (() => {
                            const points = (() => {
                              const numPoints = 10 + Math.floor(cloudRng() * 10);
                              const result = Array(numPoints);
                              for (let i = 0; i < numPoints; i++) {
                                const x = -8 + (cloudRng() * 8)
                                const y = -3 + (cloudRng() * 3)
                                const z = -8 + (cloudRng() * 8)
                                const point = new THREE.Vector3(x, y, z);
                                result[i] = point;
                              }
                              return result;
                            })();
                            const geometry = new THREEConvexGeometry(points);
                            return geometry;
                          })();
                          const material = cloudsMaterial;

                          const cloudMeshChunk = new THREE.Mesh(geometry, material);
                          cloudMeshChunk.position.x = -12 + (cloudRng() * 12);
                          cloudMeshChunk.position.z = -12 + (cloudRng() * 12);

                          result.add(cloudMeshChunk);
                        }

                        result.position.x = basePosition[0];
                        result.position.y = 30 + (cloudRng() * 10);
                        result.position.z = basePosition[1];

                        // result.receiveShadow = false;
                        // result.castShadow = true;
                        result.cloudId = cloudId;
                        result.basePosition = basePosition;
                        result.startTime = worldTime;

                        return result;
                      })();

                      cloudsMesh.add(cloudMesh);
                      newCloudMeshes.push(cloudMesh);
                    });

                    cloudsMesh.cloudMeshes = newCloudMeshes;
                  };

                  const nextWorldTime = _getWorldTime();
                  const nextPosition = _getPosition();
                  const prevWorldTime = lastWorldTime;
                  const prevPosition = lastPosition;

                  if (nextWorldTime !== prevWorldTime) {
                    _setCloudMeshFrame(nextWorldTime);
                  }

                  const nextWorldTimeSnapped = _getSnappedWorldTime(nextWorldTime);
                  const prevWorldTimeSnapped = _getSnappedWorldTime(prevWorldTime);
                  const nextPositionSnapped = _getSnappedPosition(nextPosition);
                  const prevPositionSnapped = _getSnappedPosition(prevPosition);
                  if (nextWorldTimeSnapped !== prevWorldTimeSnapped || !nextPositionSnapped.equals(prevPositionSnapped)) {
                    _setCloudMesh(nextPositionSnapped, nextWorldTimeSnapped);
                  }
                };
                updates.push(update);

                this._cleanup = () => {
                  scene.remove(cloudsMesh);

                  updates.splice(updates.indexOf(update), 1);
                };
              }

              destructor() {
                this._cleanup();
              }

              attributeValueChangedCallback(name, oldValue, newValue) {
                switch (name) {
                  case 'position': {
                    const {cloudsMesh} = this;

                    cloudsMesh.position.set(newValue[0], newValue[1], newValue[2]);
                    cloudsMesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
                    cloudsMesh.scale.set(newValue[7], newValue[8], newValue[9]);

                    break;
                  }
                }
              }
            }
          ],
          templates: [
            {
              tag: 'cloud',
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

module.exports = Cloud;
