const Alea = require('alea');
const indev = require('indev');

const ConvexGeometry = require('./lib/three-extra/ConvexGeometry');

const CLOUD_RATE = 0.00001;
const CLOUD_SPEED = 2;

class Clouds {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return Promise.all([
      archae.requestEngines([
        '/core/engines/zeo',
      ]),
      archae.requestPlugins([
        '/core/plugins/geometry-utils',
        '/core/plugins/text-utils',
        '/core/plugins/creature-utils',
      ]),
    ]).then(([
      [zeo],
      [geometryUtils, textUtils, creatureUtils],
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = zeo;

        ConvexGeometry(THREE);

        const world = zeo.getCurrentWorld();
        return world.requestMods([
          '/extra/plugins/zeo/singleplayer'
        ])
          .then(([
            singleplayer,
          ]) => {
            if (live) {

              const rng = new Alea(DEFAULT_SEED);
              const generator = indev({
                random: rng,
              });
              const cloudNoise = generator.simplex({
                frequency: 5000,
                octaves: 1,
              });

              const cloudsMaterial = new THREE.MeshBasicMaterial({
                color: 0xFFFFFF,
                opacity: 0.5,
                transparent: true,
                fog: false,
              });

              const cloudsMesh = (() => {
                const result = new THREE.Object3D();
                result.cloudMeshes = [];
                return result;
              })();
              scene.add(cloudsMesh);

              const _getWorldTime = () => world.getWorldTime();
              const _getPosition = () => {
                const player = singleplayer.getPlayer();
                const status = player.getStatus();
                return status.hmd.position;
              };

              let lastWorldTime = _getWorldTime();
              let lastPosition = _getPosition();
              const _update = () => {
                const _getSnappedWorldTime = worldTime => Math.floor(worldTime / 1000) * 1000;
                const _getSnappedPosition = position => new THREE.Vector3(
                  Math.floor(position.x / 8) * 8,
                  Math.floor(position.y / 8) * 8,
                  Math.floor(position.z / 8) * 8
                  );

                const nextWorldTime = _getWorldTime();
                const nextPosition = _getPosition();
                const prevWorldTime = lastWorldTime;
                const prevPosition = lastPosition;
                if (
                  _getSnappedWorldTime(nextWorldTime) !== _getSnappedWorldTime(prevWorldTime) ||
                  !_getSnappedPosition(nextPosition).equals(_getSnappedPosition(prevPosition))
                ) {
                  _setCloudMesh(nextPositionSnap, nextWorldTimeSnap);
                }

                const _setCloudMeshFrame = worldTime => {
                  const {cloudsMesh} = scene;
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

                    const {cloudNoise} = scene;
                    for (let y = -(NUM_CELLS * 2); y < NUM_CELLS * 2; y++) {
                      for (let x = -(NUM_CELLS * 2); x < NUM_CELLS * 2; x++) {
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
                          const geometry = new THREE.ConvexGeometry(points);
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
              };

              this._cleanup = () => {
                scene.remove(cloudsMesh);
              };

              return {
                update: _update,
              };
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Clouds;
