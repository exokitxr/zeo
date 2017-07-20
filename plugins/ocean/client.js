const NUM_CELLS = 256;
const SCALE = 4;
const TEXTURE_WIDTH = 128;
const TEXTURE_HEIGHT = 256;
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
     map2: {
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
    "attribute float color;",
    "varying vec2 vUv;",
    "varying float fogDepth;",
    "float speed = 1.0 / 200000.0;",
    "void main() {",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);",
    "  vUv = vec2(uv.x + floor(mod(worldTime * speed, 1.0) * 128.0) / 128.0, uv.y);",
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
		"uniform sampler2D map2;",
		"uniform vec3 fogColor;",
    "uniform float fogDensity;",
    "uniform float sunIntensity;",
		"varying vec2 vUv;",
    "varying float fogDepth;",
    "float speed = 2.0;",
    "void main() {",
    "  float mixFactor = 0.1 + (floor((speed - abs(mod(worldTime / 1000.0, speed*2.0) - speed)) / speed * 8.0 + 0.5) / 8.0) * 0.8;",
    "  vec4 diffuseColor = mix(texture2D( map, vUv ), texture2D( map2, vUv ), mixFactor);",
    "  diffuseColor = vec4((0.2 + 0.8 * sunIntensity) * diffuseColor.xyz, 0.8);",
    "  float fogFactor = whiteCompliment( exp2( - fogDensity * fogDensity * fogDepth * fogDepth * LOG2 ) );",
    "  gl_FragColor = vec4(mix( diffuseColor.rgb, fogColor, fogFactor ), diffuseColor.a);",
    "}"
  ].join("\n")
};
const DATA = {
  amplitude: 0.5,
  amplitudeVariance: 0.3,
  speed: 0.5,
  speedVariance: 0.5,
};

class Ocean {
  mount() {
    const {three, render, elements, pose, world, utils: {random: randomUtils, hash: hashUtils}} = zeo;
    const {THREE, scene, renderer} = three;
    const {chnkr} = randomUtils;
    const {murmur} = hashUtils;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const worker = new Worker('archae/plugins/_plugins_ocean/build/worker.js');
    const queue = [];
    worker.requestTextureImgs = () => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(TEXTURE_WIDTH * TEXTURE_HEIGHT * 4);
      worker.postMessage({
        buffer,
      }, [buffer]);
      queue.push(buffer => {
        const imgs = [
          (() => {
            const canvas = document.createElement('canvas');
            canvas.width = TEXTURE_WIDTH;
            canvas.height = TEXTURE_WIDTH;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            imageData.data.set(new Uint8Array(buffer, 0, TEXTURE_WIDTH * TEXTURE_WIDTH * 4));
            ctx.putImageData(imageData, 0, 0);
            return canvas;
          })(),
          (() => {
            const canvas = document.createElement('canvas');
            canvas.width = TEXTURE_WIDTH;
            canvas.height = TEXTURE_WIDTH;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            imageData.data.set(new Uint8Array(buffer, TEXTURE_WIDTH * TEXTURE_WIDTH * 4, TEXTURE_WIDTH * TEXTURE_WIDTH * 4));
            ctx.putImageData(imageData, 0, 0);
            return canvas;
          })(),
        ];

        accept(imgs);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    return worker.requestTextureImgs()
      .then(textureImgs => {
        if (live) {
          const textures = textureImgs.map(textureImg => {
            const texture = new THREE.Texture(
              textureImg,
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
            return texture;
          });

          const uniforms = THREE.UniformsUtils.clone(OCEAN_SHADER.uniforms);
          uniforms.map.value = textures[0];
          uniforms.map2.value = textures[1];
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
                range: 2,
              });

              const _makeOceanMesh = (ox, oy) => {
                const geometry = new THREE.PlaneBufferGeometry(NUM_CELLS, NUM_CELLS);
                const uvs = geometry.getAttribute('uv').array;
                const numUvs = uvs.length / 2;
                for (let i = 0; i < numUvs; i++) {
                  const baseIndex = i * 2;
                  uvs[baseIndex + 0] *= 16;
                  uvs[baseIndex + 1] *= 16;
                }
                // geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                // geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0));

                /* const positions = geometry.getAttribute('position').array;
                const numPositions = positions.length / 3;
                const waves = new Float32Array(numPositions * 3);
                const colors = new Float32Array(numPositions);
                for (let i = 0; i < numPositions; i++) {
                  const baseIndex = i * 3;
                  const x = positions[baseIndex + 0];
                  const y = positions[baseIndex + 1];
                  const key = `${x + (ox * NUM_CELLS)}:${-y + (oy * NUM_CELLS)}`;
                  waves[baseIndex + 0] = (murmur(key + ':ang') / 0xFFFFFFFF) * Math.PI * 2; // ang
                  waves[baseIndex + 1] = DATA.amplitude + (murmur(key + ':amp') / 0xFFFFFFFF) * DATA.amplitudeVariance; // amp
                  waves[baseIndex + 2] = (DATA.speed + (murmur(key + ':speed') / 0xFFFFFFFF) * DATA.speedVariance) / 1000; // speed
                  colors[i] = 0.7 + ((murmur(key + ':color') / 0xFFFFFFFF) * (1 - 0.7));
                }
                geometry.addAttribute('wave', new THREE.BufferAttribute(waves, 3));
                geometry.addAttribute('color', new THREE.BufferAttribute(colors, 1)); */

                const material = oceanMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(ox * NUM_CELLS, 0, oy * NUM_CELLS);
                mesh.quaternion.set(-0.7071067811865475, 0, 0, 0.7071067811865475);
                mesh.updateMatrixWorld();
                mesh.renderOrder = -100;

                mesh.update = () => {
                  const worldTime = world.getWorldTime();
                  uniforms.worldTime.value = worldTime;
                  uniforms.fogColor.value = scene.fog.color;
                  uniforms.fogDensity.value = scene.fog.density;
                };
                mesh.destroy = () => {
                  geometry.dispose();
                };

                return mesh;
              };
              const meshes = [];

              const update = () => {
                const _updateOceanChunks = () => {
                  const {hmd} = pose.getStatus();
                  const {worldPosition: hmdPosition} = hmd;
                  const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

                  for (let i = 0; i < added.length; i++) {
                    const chunk = added[i];
                    const {x, z} = chunk;
                    const oceanChunkMesh = _makeOceanMesh(x, z);
                    scene.add(oceanChunkMesh);
                    meshes.push(oceanChunkMesh);

                    chunk.data = oceanChunkMesh;
                  }
                  for (let i = 0; i < removed.length; i++) {
                    const chunk = removed[i];
                    const {data: oceanChunkMesh} = chunk;
                    scene.remove(oceanChunkMesh);
                    oceanChunkMesh.destroy();
                    meshes.splice(meshes.indexOf(oceanChunkMesh), 1);
                  }
                };
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

                _updateOceanChunks();
                _updateMeshes();
                _updateMaterial();
              };
              updates.push(update);
            
              entityElement._cleanup = () => {
                for (let i = 0; i < meshes.length; i++) {
                  const mesh = meshes[i];
                  scene.remove(mesh);
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
