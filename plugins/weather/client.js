const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  TEXTURE_SIZE,
} = require('./lib/constants/constants');

const NUM_POSITIONS = 100 * 1024;

class Weather {
  mount() {
    const {three, elements, pose, input, render, items, world, utils: {hash: hashUtils}} = zeo;
    const {THREE, scene} = three;
    const {murmur} = hashUtils;

    const rainTime = 5000;

    const WEATHER_SHADER = {
      uniforms: {
        worldTime: {
          type: 'f',
          value: 0,
        },
        map: {
          type: 't',
          value: null,
        },
        /* fogColor: {
          type: '3f',
          value: new THREE.Color(),
        },
        fogDensity: {
          type: 'f',
          value: 0,
        },
        sunIntensity: {
          type: 'f',
          value: 0,
        }, */
      },
      vertexShader: `\
        #define PI 3.1415926535897932384626433832795
        uniform float worldTime;
        attribute vec3 delta;
        attribute vec3 angle;
        attribute vec2 chunkPosition;
        attribute float type;
        varying vec2 vUv;

        void main() {
          mat4 modelView = modelViewMatrix;
          modelView[0][0] = 1.0;
          modelView[0][1] = 0.0;
          modelView[0][2] = 0.0;
          if (type != 0.0) {
            modelView[1][0] = 0.0;
            modelView[1][1] = 1.0;
            modelView[1][2] = 0.0;
          }
          modelView[2][0] = 0.0;
          modelView[2][1] = 0.0;
          modelView[2][2] = 1.0;
          modelView[3][0] = 0.0;
          modelView[3][1] = 0.0;
          modelView[3][2] = 0.0;
          modelView[3][3] = 1.0;

          float animationFactor = 0.0;
          vec3 del = delta;
          if (type == 0.0) {
            animationFactor = mod((position.y / 128.0 - worldTime / ${rainTime.toFixed(1)}), 1.0);
            del.x *= 0.05;
            del.y *= 0.8;
          } else if (type == 1.0 || type == 2.0) {
            animationFactor = 1.0 - mod((position.y / 128.0 - worldTime / 240000.0), 1.0);
            del.x *= 0.1;
            del.y *= 0.1;
          } else if (type == 3.0 || type == 4.0) {
            animationFactor = mod((position.y / 128.0 - worldTime / 60000.0), 1.0);
            del.x *= 0.1;
            del.y *= 0.1;
          }
          vec3 pos = position.xyz;
          pos.y = animationFactor * 128.0;
          pos.x += chunkPosition.x + ((-0.5 + sin(mod(angle.x + worldTime / 4000.0, 1.0) * PI * 2.0)) * angle.z);
          pos.z += chunkPosition.y + ((-0.5 + sin(mod(angle.y + worldTime / 4000.0, 1.0) * PI * 2.0)) * angle.z);
          gl_Position = projectionMatrix * vec4(
            (modelViewMatrix * vec4(pos, 1.0)).xyz +
            (modelView * vec4(del, 1.0)).xyz,
            1.0
          );

          vUv = uv;
          vUv.x = type/5.0 + vUv.x * 1.0/5.0;
        }
      `,
      fragmentShader: `\
        uniform sampler2D map;
        varying vec2 vUv;

        void main() {
          vec4 diffuseColor = texture2D(map, vUv);

          if (diffuseColor.a < 0.1) {
            discard;
          }

          gl_FragColor = diffuseColor;
        }
      `
    };

    const _resBlob = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.blob();
      } else {
        return Promise.reject({
          status: res.status,
          stack: 'API returned invalid status code: ' + res.status,
        });
      }
    };
    const _resJson = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.json();
      } else {
        return Promise.reject({
          status: res.status,
          stack: 'API returned invalid status code: ' + res.status,
        });
      }
    };

    const _requestUpdateTextureAtlas = () => fetch(`/archae/weather/texture-atlas.png`, {
        credentials: 'include',
      })
      .then(_resBlob)
      .then(blob => createImageBitmap(blob, 0, 0, 15, 3, {
        imageOrientation: 'flipY',
      }))
      .then(imageBitmap => {
        textureAtlas.image = imageBitmap;
        textureAtlas.needsUpdate = true;
      });

    const textureAtlas = new THREE.Texture(
      null,
      THREE.UVMapping,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
      THREE.NearestFilter,
      THREE.NearestFilter,
      // THREE.LinearMipMapLinearFilter,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
      1
    );
    let textureUvs = null;

    const _getUv = name => textureUvs[murmur(name)];
    const _getTileUv = name => {
      const uv = textureUvs[murmur(name)];

      const tileSizeU = uv[2] - uv[0];
      const tileSizeV = uv[3] - uv[1];

      const tileSizeIntU = Math.floor(tileSizeU * TEXTURE_SIZE) / 2;
      const tileSizeIntV = Math.floor(tileSizeV * TEXTURE_SIZE) / 2;

      const u = tileSizeIntU + uv[0];
      const v = tileSizeIntV + uv[1];

      return [-u, 1 - v, -u, 1 - v];
    };

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return _requestUpdateTextureAtlas()
      .then(() => {
        if (live) {
          class Weather {
            constructor(position, angle) {
              this.position = position;
              this.angle = angle;
            }
          }

          /* const weatherGeometries = [
            new THREE.PlaneBufferGeometry(0.05, 0.8),
            new THREE.PlaneBufferGeometry(0.1, 0.1),
            new THREE.PlaneBufferGeometry(0.05, 0.05),
          ]; */
          const weatherGeometry = new THREE.PlaneBufferGeometry(1, 1).toNonIndexed();
          const weatherGeometryPositions = weatherGeometry.getAttribute('position').array;
          const numWeatherGeometryPositions = weatherGeometryPositions.length / 3;
          const weatherGeometryUvs = weatherGeometry.getAttribute('uv').array;
          const numWeatherGeometryUvs = weatherGeometryUvs.length / 2;
          // const weatherGeometryIndices = weatherGeometry.index.array;
          // const numWeatherGeometryIndices = weatherGeometryIndices.length;
          const numWeathers = 500;
          const geometry = new THREE.InstancedBufferGeometry();
          const positions = new Float32Array(weatherGeometryPositions.length * numWeathers);
          const positionsAttribute = new THREE.BufferAttribute(positions, 3);
          geometry.addAttribute('position', positionsAttribute);
          const deltas = new Float32Array(weatherGeometryPositions.length * numWeathers);
          const deltasAttribute = new THREE.BufferAttribute(deltas, 3);
          geometry.addAttribute('delta', deltasAttribute);
          const uvs = new Float32Array(weatherGeometryUvs.length * numWeathers);
          const uvsAttribute = new THREE.BufferAttribute(uvs, 2);
          geometry.addAttribute('uv', uvsAttribute);
          const angles = new Float32Array(weatherGeometryPositions.length * numWeathers);
          const anglesAttribute = new THREE.BufferAttribute(angles, 3);
          geometry.addAttribute('angle', anglesAttribute);
          const chunkPositions = new Float32Array(NUM_POSITIONS);
          const chunkPositionsAttribute = new THREE.InstancedBufferAttribute(chunkPositions.subarray(0, 0), 2, 1);
          geometry.addAttribute('chunkPosition', chunkPositionsAttribute);
          const types = new Float32Array(NUM_POSITIONS);
          const typesAttribute = new THREE.InstancedBufferAttribute(types.subarray(0, 0), 1, 1);
          geometry.addAttribute('type', typesAttribute);
          // const indices = new Uint16Array(numWeatherGeometryIndices.length * numWeathers);
          // const indexAttribute = new THREE.BufferAttribute(indices, 1);
          // geometry.setIndex(indexAttribute);
          // geometry.setDrawRange(0, 0);

          const uniforms = THREE.UniformsUtils.clone(WEATHER_SHADER.uniforms);
          uniforms.map.value = textureAtlas;
          const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: WEATHER_SHADER.vertexShader,
            fragmentShader: WEATHER_SHADER.fragmentShader,
            transparent: true,
          });

          const weathersMesh = new THREE.Mesh(geometry, material);
          weathersMesh.frustumCulled = false;

          const weathers = Array(numWeathers);
          for (let i = 0; i < numWeathers; i++) {
            const weather = new Weather(
              new THREE.Vector3(Math.random() * NUM_CELLS, Math.random() * NUM_CELLS_HEIGHT, Math.random() * NUM_CELLS),
              // _getUv('rain'),
              new THREE.Vector3(Math.random(), Math.random(), Math.random())
            );
            weathers[i] = weather;
          }

          let attributeIndex = 0;
          let uvIndex = 0;
          // let indexIndex = 0;
          let instanceIndex = 0;
          for (let i = 0; i < weathers.length; i++) {
            const {position, type, angle} = weathers[i];
            const uv = [
              0, 0,
              1, 1,
            ];
            const uvWidth = uv[2] - uv[0];
            const uvHeight = uv[3] - uv[1];
            const newGeometryPositions = weatherGeometryPositions;
            const newGeometryUvs = weatherGeometryUvs;
            // const newGeometryIndices = weatherGeometryIndices;

            for (let j = 0; j < numWeatherGeometryPositions; j++) {
              const basePositionIndex = attributeIndex + j * 3;
              const srcBasePositionIndex = j * 3;
              positions[basePositionIndex + 0] = position.x;
              positions[basePositionIndex + 1] = position.y;
              positions[basePositionIndex + 2] = position.z;

              deltas[basePositionIndex + 0] = newGeometryPositions[srcBasePositionIndex + 0];
              deltas[basePositionIndex + 1] = newGeometryPositions[srcBasePositionIndex + 1];
              deltas[basePositionIndex + 2] = newGeometryPositions[srcBasePositionIndex + 2];

              const baseUvIndex = uvIndex + j * 2;
              const srcBaseUvIndex = j * 2;
              uvs[baseUvIndex + 0] = newGeometryUvs[srcBaseUvIndex + 0];
              uvs[baseUvIndex + 1] = newGeometryUvs[srcBaseUvIndex + 1];
              /* uvs[baseUvIndex + 0] = uv[0] + newGeometryUvs[srcBaseUvIndex + 0] * uvWidth;
              uvs[baseUvIndex + 1] = 1 - (uv[1] + newGeometryUvs[srcBaseUvIndex + 1] * uvHeight); */

              angles[basePositionIndex + 0] = angle.x;
              angles[basePositionIndex + 1] = angle.y;
              angles[basePositionIndex + 2] = angle.z;
            }

            /* for (let j = 0; j < numWeatherGeometryIndices; j++) {
              const baseIndex = indexIndex + j;
              const baseAttributeIndex = attributeIndex / 3;
              indices[baseIndex] = newGeometryIndices[j] + baseAttributeIndex;
            } */

            attributeIndex += numWeatherGeometryPositions * 3;
            uvIndex += numWeatherGeometryUvs * 2;
            // indexIndex += numWeatherGeometryIndices;
          }
          positionsAttribute.needsUpdate = true;
          deltasAttribute.needsUpdate = true;
          uvsAttribute.needsUpdate = true;
          anglesAttribute.needsUpdate = true;
          // indexAttribute.needsUpdate = true;

          const _addRain = (x, z) => {
            const basePositionIndex = instanceIndex * 2;
            chunkPositions[basePositionIndex + 0] = x * NUM_CELLS;
            chunkPositions[basePositionIndex + 1] = z * NUM_CELLS;

            const baseTypeIndex = instanceIndex;
            types[baseTypeIndex] = 0;

            instanceIndex++;

            geometry.addAttribute('chunkPosition', new THREE.InstancedBufferAttribute(chunkPositions.subarray(0, instanceIndex * 2), 2, 1));
            geometry.addAttribute('type', new THREE.InstancedBufferAttribute(types.subarray(0, instanceIndex), 1, 1));

            // geometry.setDrawRange(0, numWeathers * 3);
          };
          const _addSmoke = (x, z) => {
            const basePositionIndex = instanceIndex * 2;
            chunkPositions[basePositionIndex + 0] = x * NUM_CELLS;
            chunkPositions[basePositionIndex + 1] = z * NUM_CELLS;

            const baseTypeIndex = instanceIndex;
            types[baseTypeIndex] = Math.random < 0.5 ? 1 : 2;

            instanceIndex++;

            geometry.addAttribute('chunkPosition', new THREE.InstancedBufferAttribute(chunkPositions.subarray(0, instanceIndex * 2), 2, 1));
            geometry.addAttribute('type', new THREE.InstancedBufferAttribute(types.subarray(0, instanceIndex), 1, 1));

            // geometry.setDrawRange(0, numWeathers * 3);
          };
          const _addSnow = (x, z) => {
            const basePositionIndex = instanceIndex * 2;
            chunkPositions[basePositionIndex + 0] = x * NUM_CELLS;
            chunkPositions[basePositionIndex + 1] = z * NUM_CELLS;

            const baseTypeIndex = instanceIndex;
            types[baseTypeIndex] = Math.random < 0.5 ? 3 : 4;

            instanceIndex++;

            geometry.addAttribute('chunkPosition', new THREE.InstancedBufferAttribute(chunkPositions.subarray(0, instanceIndex * 2), 2, 1));
            geometry.addAttribute('type', new THREE.InstancedBufferAttribute(types.subarray(0, instanceIndex), 1, 1));

            // geometry.setDrawRange(0, numWeathers * 3);
          };
          _addRain(0, 0);
          _addSnow(-1, 0);
          _addSmoke(0, -1);
/* const basePositionIndex = instanceIndex * 3;
chunkPositions[basePositionIndex + 0] = 1 * NUM_CELLS;
chunkPositions[basePositionIndex + 1] = 0;
chunkPositions[basePositionIndex + 2] = 1 * NUM_CELLS;

const baseTypeIndex = instanceIndex;
types[baseTypeIndex] = 2;

chunkPositionsAttribute.needsUpdate = true;
typesAttribute.needsUpdate = true; */

window.weathersMesh = weathersMesh;

          const _update = () => {
            const _updateMeshes = () => {
              if (weathers.length > 0 && !weathersMesh.parent) {
                scene.add(weathersMesh);
              } else if (weathers.length === 0 && weathersMesh.parent) {
                scene.remove(weathersMesh);
              }
            };
            const _updateMaterials = () => {
              if (weathers.length > 0) {
                weathersMesh.material.uniforms.worldTime.value = world.getWorldTime() % (10 * 60 * 1000);
              }
            };

            _updateMeshes();
            _updateMaterials();
          };
          render.on('update', _update);

          this._cleanup = () => {
            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Weather;
