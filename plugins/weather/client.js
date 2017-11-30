const {
  NUM_CELLS,
  NUM_CELLS_HEIGHT,

  RANGE,

  TEXTURE_SIZE,
} = require('./lib/constants/constants');

const GENERATOR_PLUGIN = 'generator';

class Weather {
  mount() {
    const {three, elements, pose, input, render, items, world, utils: {js: jsUtils, hash: hashUtils}} = zeo;
    const {THREE, scene} = three;
    const {mod} = jsUtils;
    const {murmur} = hashUtils;

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
        attribute vec4 angle;
        attribute vec2 chunkPosition;
        attribute float type;
        attribute float offset;
        attribute float valid;
        varying vec2 vUv;

        void main() {
          if (valid > 0.0) {
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

            vec3 pos = position.xyz;
            vec3 del = delta;
            if (type == 0.0) {
              float animationFactor = mod((position.y / 128.0 + offset - worldTime / 4000.0), 1.0);
              pos.y = animationFactor * 128.0;
              del.x *= 0.05;
              del.y *= 0.8;
            } else if (type == 1.0 || type == 2.0) {
              float animationFactor = 1.0 - mod((position.y / 128.0 + offset - worldTime / 240000.0), 1.0);
              pos.y = animationFactor * 128.0;
              del.x *= 0.1;
              del.y *= 0.1;
            } else if (type == 3.0 || type == 4.0) {
              float animationFactor = mod((position.y / 128.0 + offset - worldTime / 60000.0), 1.0);
              pos.y = animationFactor * 128.0;
              del.x *= 0.1;
              del.y *= 0.1;
            } else if (type == 5.0 || type == 6.0) {
              del.x *= 0.1;
              del.y *= 0.1;
            }
            pos.x += chunkPosition.x;
            pos.z += chunkPosition.y;
            if (type != 0.0) {
              if (type != 5.0 && type != 6.0) {
                pos.x += ((-0.5 + sin(mod(angle.x + worldTime / 4000.0, 1.0) * PI * 2.0)) * angle.z);
                pos.z += ((-0.5 + sin(mod(angle.y + worldTime / 4000.0, 1.0) * PI * 2.0)) * angle.z);
              } else {
                pos.x += ((-0.5 + sin(mod(offset + angle.w + angle.x + worldTime / 8000.0, 1.0) * PI * 2.0)) * angle.x);
                pos.y += ((-0.5 + sin(mod(offset + angle.w + angle.y + worldTime / 8000.0, 1.0) * PI * 2.0)) * angle.y);
                pos.z += ((-0.5 + sin(mod(offset + angle.w + angle.z + worldTime / 8000.0, 1.0) * PI * 2.0)) * angle.z);
              }
            }
            gl_Position = projectionMatrix * vec4(
              (modelViewMatrix * vec4(pos, 1.0)).xyz +
              (modelView * vec4(del, 1.0)).xyz,
              1.0
            );

            vUv = uv;
            vUv.x = type*75.0/128.0/5.0 + vUv.x * 1.0*75.0/128.0/5.0;
          } else {
            gl_Position = vec4(0.0);
          }
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

    const _requestImage = url => new Promise((accept, reject) => {
      const img = new Image();

      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(img);
      };

      img.crossOrigin = 'Anonymous';
      img.src = url;
    });
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

    const _requestUpdateTextureAtlas = () => _requestImage('/archae/weather/texture-atlas.png')
      .then(img => createImageBitmap(img, 0, 0, img.width, img.height, {
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

    return Promise.all([
      elements.requestElement(GENERATOR_PLUGIN),
      _requestUpdateTextureAtlas(),
    ])
      .then(([
        generatorElement,
        textureAtlasResult,
      ]) => {
        if (live) {
          const modelViewMatrices = {
            left: new THREE.Matrix4(),
            right: new THREE.Matrix4(),
          };
          const normalMatrices = {
            left: new THREE.Matrix3(),
            right: new THREE.Matrix3(),
          };
          const modelViewMatricesValid = {
            left: false,
            right: false,
          };
          const normalMatricesValid = {
            left: false,
            right: false,
          };
          const uniformsNeedUpdate = {
            heightfield: {
              left: true,
              right: true,
            },
            ocean: {
              left: true,
              right: true,
            },
          };
          function _updateModelViewMatrix(camera) {
            if (!modelViewMatricesValid[camera.name]) {
              modelViewMatrices[camera.name].multiplyMatrices(camera.matrixWorldInverse, this.matrixWorld);
              modelViewMatricesValid[camera.name] = true;
            }
            this.modelViewMatrix = modelViewMatrices[camera.name];
          }
          function _updateNormalMatrix(camera) {
            if (!normalMatricesValid[camera.name]) {
              normalMatrices[camera.name].getNormalMatrix(this.modelViewMatrix);
              normalMatricesValid[camera.name] = true;
            }
            this.normalMatrix = normalMatrices[camera.name];
          }
          function _uniformsNeedUpdateHeightfield(camera) {
            if (uniformsNeedUpdate.heightfield[camera.name]) {
              uniformsNeedUpdate.heightfield[camera.name] = false;
              return true;
            } else {
              return false;
            }
          }
          function _uniformsNeedUpdateOcean(camera) {
            if (uniformsNeedUpdate.ocean[camera.name]) {
              uniformsNeedUpdate.ocean[camera.name] = false;
              return true;
            } else {
              return false;
            }
          }

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
          const angles = new Float32Array(weatherGeometryPositions.length / 3 * 4 * numWeathers);
          const anglesAttribute = new THREE.BufferAttribute(angles, 4);
          geometry.addAttribute('angle', anglesAttribute);
          const chunkPositions = new Float32Array(RANGE * RANGE * 2 * 2);
          const chunkPositionsAttribute = new THREE.InstancedBufferAttribute(chunkPositions, 2, 1);
          chunkPositionsAttribute.dynamic = true;
          geometry.addAttribute('chunkPosition', chunkPositionsAttribute);
          const types = new Float32Array(RANGE * RANGE * 1 * 2);
          const typesAttribute = new THREE.InstancedBufferAttribute(types, 1, 1);
          typesAttribute.dynamic = true;
          geometry.addAttribute('type', typesAttribute);
          const offsets = new Float32Array(RANGE * RANGE * 1 * 2);
          const offsetAttribute = new THREE.InstancedBufferAttribute(offsets, 1, 1);
          offsetAttribute.dynamic = true;
          geometry.addAttribute('offset', offsetAttribute);
          const valids = new Float32Array(RANGE * RANGE * 1 * 2);
          const validsAttribute = new THREE.InstancedBufferAttribute(valids, 1, 1);
          validsAttribute.dynamic = true;
          geometry.addAttribute('valid', validsAttribute);
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
            side: THREE.DoubleSide,
            transparent: true,
          });

          const weathersMesh = new THREE.Mesh(geometry, material);
          weathersMesh.updateModelViewMatrix = _updateModelViewMatrix;
          weathersMesh.updateNormalMatrix = _updateNormalMatrix;
          weathersMesh.frustumCulled = false;

          const weathers = Array(numWeathers);
          for (let i = 0; i < numWeathers; i++) {
            const weather = new Weather(
              new THREE.Vector3(Math.random() * NUM_CELLS, Math.random() * NUM_CELLS_HEIGHT, Math.random() * NUM_CELLS),
              new THREE.Vector4(Math.random(), Math.random(), Math.random(), Math.random())
            );
            weathers[i] = weather;
          }

          let attributeIndex = 0;
          let uvIndex = 0;
          let angleIndex = 0;
          // let indexIndex = 0;
          let instanceIndex = 0;
          for (let i = 0; i < weathers.length; i++) {
            const {position, type, angle} = weathers[i];
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

              const baseAngleIndex = angleIndex + j * 4;
              angles[baseAngleIndex + 0] = angle.x;
              angles[baseAngleIndex + 1] = angle.y;
              angles[baseAngleIndex + 2] = angle.z;
              angles[baseAngleIndex + 3] = angle.w;
            }

            /* for (let j = 0; j < numWeatherGeometryIndices; j++) {
              const baseIndex = indexIndex + j;
              const baseAttributeIndex = attributeIndex / 3;
              indices[baseIndex] = newGeometryIndices[j] + baseAttributeIndex;
            } */

            attributeIndex += numWeatherGeometryPositions * 3;
            uvIndex += numWeatherGeometryUvs * 2;
            angleIndex += numWeatherGeometryPositions * 4;
            // indexIndex += numWeatherGeometryIndices;
          }
          positionsAttribute.needsUpdate = true;
          deltasAttribute.needsUpdate = true;
          uvsAttribute.needsUpdate = true;
          anglesAttribute.needsUpdate = true;
          // indexAttribute.needsUpdate = true;

          const _addRain = (index, x, z) => {
            const basePositionIndex = index * 2;
            chunkPositions[basePositionIndex + 0] = x * NUM_CELLS;
            chunkPositions[basePositionIndex + 1] = z * NUM_CELLS;

            const baseTypeIndex = index;
            types[baseTypeIndex] = 0;

            const baseOffsetIndex = index;
            offsets[baseOffsetIndex] = Math.random();
          };
          const _addSnow = (index, x, z) => {
            const basePositionIndex = index * 2;
            chunkPositions[basePositionIndex + 0] = x * NUM_CELLS;
            chunkPositions[basePositionIndex + 1] = z * NUM_CELLS;

            const baseTypeIndex = index;
            types[baseTypeIndex] = Math.random < 0.5 ? 3 : 4;

            const baseOffsetIndex = index;
            offsets[baseOffsetIndex] = Math.random();
          };
          const _addSmoke = (index, x, z) => {
            const basePositionIndex = index * 2;
            chunkPositions[basePositionIndex + 0] = x * NUM_CELLS;
            chunkPositions[basePositionIndex + 1] = z * NUM_CELLS;

            const baseTypeIndex = index;
            types[baseTypeIndex] = Math.random < 0.5 ? 1 : 2;

            const baseOffsetIndex = index;
            offsets[baseOffsetIndex] = Math.random();
          };
          const _addPollen = (index, x, z) => {
            const basePositionIndex = index * 2;
            chunkPositions[basePositionIndex + 0] = x * NUM_CELLS;
            chunkPositions[basePositionIndex + 1] = z * NUM_CELLS;

            const baseTypeIndex = index;
            types[baseTypeIndex] = Math.random < 0.5 ? 5 : 6;

            const baseOffsetIndex = index;
            offsets[baseOffsetIndex] = Math.random();
          };

          const _allocIndex = () => {
            for (let i = 0; i < valids.length; i++) {
              if (valids[i] === 0) {
                valids[i] = 1;
                return i;
              }
            }
            return -1;
          };
          const _freeIndex = i => {
            valids[i] = 0;
          };

          const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);
          const meshWeathers = {};
          let running = false;
          const queue = [];
          const _next = () => {
            running = false;

            if (queue.length > 0) {
              queue.shift()();
            }
          };
          const _requestTemperatureHumidity = (x, z, cb) => {
            generatorElement.requestTemperatureHumidity(x, z, cb);
          };
          const _add = chunk => {
            if (!running) {
              const {x, z} = chunk;

              _requestTemperatureHumidity(x, z, ({temperature, humidity}) => {
                if (humidity[0] > 130) {
                  if (temperature[0] > 110) {
                    const index = _allocIndex();
                    _addRain(index, x, z);
                    meshWeathers[_getChunkIndex(x, z)] = index;
                    chunkPositionsAttribute.needsUpdate = true;
                    typesAttribute.needsUpdate = true;
                    offsetAttribute.needsUpdate = true;
                    validsAttribute.needsUpdate = true;
                  } else {
                    const index = _allocIndex();
                    _addSnow(index, x, z);
                    meshWeathers[_getChunkIndex(x, z)] = index;
                    chunkPositionsAttribute.needsUpdate = true;
                    typesAttribute.needsUpdate = true;
                    offsetAttribute.needsUpdate = true;
                    validsAttribute.needsUpdate = true;
                  }
                } else if (humidity[0] < 100) {
                  if (temperature[0] > 140) {
                    const index = _allocIndex();
                    _addSmoke(index, x, z);
                    meshWeathers[_getChunkIndex(x, z)] = index;
                    chunkPositionsAttribute.needsUpdate = true;
                    typesAttribute.needsUpdate = true;
                    offsetAttribute.needsUpdate = true;
                    validsAttribute.needsUpdate = true;
                  } else if (temperature[0] > 110) {
                    const index = _allocIndex();
                    _addPollen(index, x, z);
                    meshWeathers[_getChunkIndex(x, z)] = index;
                    chunkPositionsAttribute.needsUpdate = true;
                    typesAttribute.needsUpdate = true;
                    offsetAttribute.needsUpdate = true;
                    validsAttribute.needsUpdate = true;
                  }
                }

                _next();
              });
            } else {
              queue.push(_add.bind(this, chunk));
            }
          };
          generatorElement.on('add', _add);
          const _remove = chunk => {
            const {x, z} = chunk;

            const chunkIndex = _getChunkIndex(x, z);
            const index = meshWeathers[chunkIndex];
            meshWeathers[chunkIndex] = null;
            _freeIndex(index);
          };
          generatorElement.on('remove', _remove);
          generatorElement.forEachChunk(chunk => {
            _add(chunk);
          });

          const _updateMatrices = () => {
            modelViewMatricesValid.left = false;
            modelViewMatricesValid.right = false;
            normalMatricesValid.left = false;
            normalMatricesValid.right = false;
            uniformsNeedUpdate.heightfield.left = true;
            uniformsNeedUpdate.heightfield.right = true;
            uniformsNeedUpdate.ocean.left = true;
            uniformsNeedUpdate.ocean.right = true;
          };
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
          const _beforeRender = () => {
            _updateMatrices();
          };
          render.on('beforeRender', _beforeRender);

          this._cleanup = () => {
            scene.remove(weathersMesh);

            render.removeListener('update', _update);
            render.removeListener('beforeRender', _beforeRender);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Weather;
