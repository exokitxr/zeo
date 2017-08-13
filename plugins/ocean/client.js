const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_CELLS = 256;
const RANGE = 2;
const NUM_POSITIONS_CHUNK = 200 * 1024;
const DAY_NIGHT_SKYBOX_PLUGIN = 'plugins-day-night-skybox';

const OCEAN_SHADER = {
  uniforms: {
    worldTime: {
      type: 'f',
      value: 0,
    },
    map: {
      type: 't',
      value: null,
    },
    fogColor: {
      type: '3f',
    },
    fogDensity: {
      type: 'f',
    },
    sunIntensity: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: [
		"uniform float worldTime;",
    "attribute vec3 wave;",
    "varying vec2 vUv;",
    "varying float fogDepth;",
    "void main() {",
    "  float ang = wave[0];",
    "  float amp = wave[1];",
    "  float speed = wave[2];",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, ((sin(ang + (speed * worldTime))) * amp), position.z, 1.0);",
    "  vUv = uv;",
    "  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
    "  fogDepth = -mvPosition.z;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "#define PI 3.1415926535897932384626433832795",
    "#define LOG2 1.442695",
    "#define whiteCompliment(a) ( 1.0 - saturate( a ) )",
		"uniform float worldTime;",
		"uniform sampler2D map;",
		"uniform vec3 fogColor;",
    "uniform float fogDensity;",
    "uniform float sunIntensity;",
		"varying vec2 vUv;",
    "varying float fogDepth;",
    "float speed = 2.0;",
    "void main() {",
    "  float animationFactor = (speed - abs(mod(worldTime / 1000.0, speed*2.0) - speed)) / speed;",
    "  float frame1 = mod(floor(animationFactor / 16.0), 1.0);",
    "  float frame2 = mod(frame1 + 1.0/16.0, 1.0);",
    "  float mixFactor = fract(animationFactor / 16.0) * 16.0;",
    "  vec4 diffuseColor = mix(texture2D( map, vUv * vec2(1.0, 1.0 - frame1) ), texture2D( map, vUv * vec2(1.0, 1.0 - frame2) ), mixFactor);",
    "  diffuseColor = vec4((0.2 + 0.8 * sunIntensity) * diffuseColor.xyz, 0.7);",
    "  float fogFactor = whiteCompliment( exp2( - fogDensity * fogDensity * fogDepth * fogDepth * LOG2 ) );",
    "  gl_FragColor = vec4(mix( diffuseColor.rgb, fogColor, fogFactor ), diffuseColor.a);",
    "}"
  ].join("\n")
};

class Ocean {
  mount() {
    const {three, render, elements, pose, world, stage, utils: {js: jsUtils, random: randomUtils, hash: hashUtils}} = zeo;
    const {THREE, scene} = three;
    const {bffr} = jsUtils;
    const {chnkr} = randomUtils;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const buffers = bffr(NUM_POSITIONS_CHUNK, (RANGE * 2) * (RANGE * 2) * 2);
    const worker = new Worker('archae/plugins/_plugins_ocean/build/worker.js');
    const queues = [];
    worker.requestGenerate = (x, z, lod) => new Promise((accept, reject) => {
      const buffer = buffers.alloc();
      worker.postMessage({
        x,
        z,
        lod,
        buffer,
      }, [buffer]);
      queues.push(accept);
    });
    worker.onmessage = e => {
      queues.shift()(e.data)
    };
    const _requestOceanGenerate = (x, z, lod) => worker.requestGenerate(x, z, lod)
      .then(oceanBuffer => protocolUtils.parseGeometry(oceanBuffer));

    const _requestImg = src => new Promise((accept, reject) => {
      const img = new Image();
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
      // img.crossOrigin = 'Anonymous';
      img.src = src;
    });

    return _requestImg('/archae/ocean/img/water.png')
      .then(waterImg => {
        if (live) {
          const texture = new THREE.Texture(
            waterImg,
            THREE.UVMapping,
            THREE.RepeatWrapping,
            THREE.RepeatWrapping,
            // THREE.LinearMipMapLinearFilter,
            // THREE.LinearMipMapLinearFilter,
            THREE.NearestFilter,
            THREE.NearestFilter,
            // THREE.NearestMipMapNearestFilter,
            // THREE.NearestMipMapNearestFilter,
            // THREE.LinearFilter,
            // THREE.LinearFilter,
            // THREE.NearestFilter,
            // THREE.NearestFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
            1
          );
          texture.needsUpdate = true;

          const uniforms = THREE.UniformsUtils.clone(OCEAN_SHADER.uniforms);
          uniforms.map.value = texture;
          uniforms.fogColor.value = scene.fog.color;
          uniforms.fogDensity.value = scene.fog.density;
          const oceanMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: OCEAN_SHADER.vertexShader,
            fragmentShader: OCEAN_SHADER.fragmentShader,
            transparent: true,
          });

          const updates = [];
          const _update = () => {
            for (let i = 0; i < updates.length; i++) {
              const update = updates[i];
              update();
            }
          };

          const oceanEntity = {
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
              const chunker = chnkr.makeChunker({
                resolution: NUM_CELLS,
                range: RANGE,
              });
              const meshes = [];

              const update = () => {
                const _updateMeshes = () => {
                  for (let i = 0; i < meshes.length; i++) {
                    const mesh = meshes[i];
                    mesh.update();
                  }
                };
                const _updateMaterial = () => {
                  oceanMaterial.uniforms.sunIntensity.value = (() => {
                    const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
                    return (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;
                  })();
                };

                _updateMeshes();
                _updateMaterial();
              };
              updates.push(update);

              const _makeOceanChunkMesh = (x, z, oceanChunkData) => {
                const {positions, uvs, waves, indices} = oceanChunkData;
                const geometry = new THREE.BufferGeometry();
                geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                geometry.addAttribute('wave', new THREE.BufferAttribute(waves, 3));
                geometry.setIndex(new THREE.BufferAttribute(indices, 1));
                const maxY = 100;
                const minY = -100;
                geometry.boundingSphere = new THREE.Sphere(
                  new THREE.Vector3(
                    (x * NUM_CELLS) + (NUM_CELLS / 2),
                    (minY + maxY) / 2,
                    (z * NUM_CELLS) + (NUM_CELLS / 2)
                  ),
                  Math.max(Math.sqrt((NUM_CELLS / 2) * (NUM_CELLS / 2) * 3), (maxY - minY) / 2) // XXX really compute this
                );
                const material = oceanMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.update = () => {
                  uniforms.worldTime.value = world.getWorldTime();
                  uniforms.fogColor.value = scene.fog.color;
                  uniforms.fogDensity.value = scene.fog.density;
                };
                mesh.destroy = () => {
                  geometry.dispose();

                  buffers.free(oceanChunkData.buffer);
                };
                return mesh;
              };

              const _requestRefreshOceanChunks = () => {
                const {hmd} = pose.getStatus();
                const {worldPosition: hmdPosition} = hmd;
                const {added, removed, relodded} = chunker.update(hmdPosition.x, hmdPosition.z);

                const promises = [];
                const _addChunk = chunk => {
                  const {x, z, lod, data: oldData} = chunk;

                  if (oldData) {
                    const {oceanChunkMesh} = oldData;
                    scene.remove(oceanChunkMesh);
                    oceanChunkMesh.destroy();
                    meshes.splice(meshes.indexOf(oceanChunkMesh), 1);
                  }

                  const promise = _requestOceanGenerate(x, z, lod)
                    .then(oceanChunkData => {
                      const oceanChunkMesh = _makeOceanChunkMesh(x, z, oceanChunkData);
                      scene.add(oceanChunkMesh);
                      meshes.push(oceanChunkMesh);

                      chunk.data = {
                        oceanChunkMesh,
                      };
                    });
                  promises.push(promise);
                };
                for (let i = 0; i < added.length; i++) {
                  _addChunk(added[i]);
                }
                for (let i = 0; i < relodded.length; i++) {
                  _addChunk(relodded[i]);
                }
                return Promise.all(promises)
                  .then(() => {
                    for (let i = 0; i < removed.length; i++) {
                      const chunk = removed[i];
                      const {data} = chunk;
                      const {oceanChunkMesh} = data;
                      scene.remove(oceanChunkMesh);
                      oceanChunkMesh.destroy();
                      meshes.splice(meshes.indexOf(oceanChunkMesh), 1);
                    }
                  });
              };

              let live = true;
              const _recurse = () => {
                _requestRefreshOceanChunks()
                  .then(() => {
                    if (live) {
                      setTimeout(_recurse, 1000);
                    }
                  })
                  .catch(err => {
                    if (live) {
                      console.warn(err);

                      setTimeout(_recurse, 1000);
                    }
                  });
              };
              _recurse();
            
              entityElement._cleanup = () => {
                live = false;

                for (let i = 0; i < meshes.length; i++) {
                  const mesh = meshes[i];
                  stage.remove('main', mesh);
                }

                updates.splice(updates.indexOf(update), 1);
              };
            },
            entityRemovedCallback(entityElement) {
              entityElement._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              switch (name) {
                case 'position': {
                  const {mesh} = entityElement;

                  mesh.position.set(newValue[0], newValue[1], newValue[2]);
                  mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
                  mesh.scale.set(newValue[7], newValue[8], newValue[9]);

                  break;
                }
              }
            },
          };
          elements.registerEntity(this, oceanEntity);

          render.on('update', _update);

          this._cleanup = () => {
            worker.terminate();

            elements.unregisterEntity(this, oceanEntity);

            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Ocean;
