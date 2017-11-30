const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
  NUM_CELLS_HEIGHT,

  NUM_CHUNKS_HEIGHT,
  NUM_RENDER_GROUPS,

  RANGE,

  NUM_POSITIONS_CHUNK,
} = require('./lib/constants/constants');

const GENERATOR_PLUGIN = 'generator';
const DAY_NIGHT_SKYBOX_PLUGIN = 'day-night-skybox';
const HEALTH_PLUGIN = 'health';
const DEFAULT_USER_HEIGHT = 1.6;

const dataSymbol = Symbol();

class Heightfield {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, input, world, elements, teleport, stck, sound, utils: {js: {mod, sbffr}, random: {chnkr}}} = zeo;
    const {THREE, scene, camera, renderer} = three;

    const HEIGHTFIELD_SHADER = {
      uniforms: {
        fogColor: {
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
        },
      },
      vertexShader: `\
        #define LOG2 1.442695
        precision highp float;
        precision highp int;
        /*uniform mat4 modelMatrix;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform mat4 viewMatrix;
        uniform mat3 normalMatrix;
        attribute vec3 position;
        attribute vec3 normal;
        attribute vec2 uv; */
        uniform float fogDensity;
        attribute vec3 color;
        attribute float skyLightmap;
        attribute float torchLightmap;

        // varying vec3 vPosition;
        varying vec3 vViewPosition;
        varying vec3 vColor;
        varying float vSkyLightmap;
        varying float vTorchLightmap;
        // varying float vFog;

        void main() {
          vColor = color.rgb;

          vec4 mvPosition = modelViewMatrix * vec4( position.xyz, 1.0 );
          gl_Position = projectionMatrix * mvPosition;

          // vPosition = position.xyz;
          vViewPosition = -mvPosition.xyz;
          vSkyLightmap = skyLightmap;
          vTorchLightmap = torchLightmap;
          // float fogDepth = -mvPosition.z;
          // vFog = 1.0 - exp2( - fogDensity * fogDensity * fogDepth * fogDepth * LOG2 );
        }
      `,
      fragmentShader: `\
        precision highp float;
        precision highp int;
        uniform vec3 ambientLightColor;
        uniform float sunIntensity;
        uniform vec3 fogColor;

        // varying vec3 vPosition;
        varying vec3 vViewPosition;
        varying vec3 vColor;
        varying float vSkyLightmap;
        varying float vTorchLightmap;
        // varying float vFog;

        #define saturate(a) clamp( a, 0.0, 1.0 )

        void main() {
          float lightColor = floor(
            (
              min((vSkyLightmap * sunIntensity) + vTorchLightmap, 1.0)
            ) * 4.0 + 0.5
          ) / 4.0;

          vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );
          vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );
          vec3 normal = normalize( cross( fdx, fdy ) );
          float dotNL = saturate( dot( normal, normalize(vViewPosition)) );
          vec3 irradiance = ambientLightColor + (dotNL * 1.5);
          vec3 diffuseColor = vColor * irradiance * (0.1 + lightColor * 0.9);
          // diffuseColor = mix(diffuseColor, fogColor, vFog);

          gl_FragColor = vec4( diffuseColor, 1.0 );
        }
      `
    };

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
          value: new THREE.Color(),
        },
        fogDensity: {
          type: 'f',
          value: 0,
        },
        sunIntensity: {
          type: 'f',
          value: 0,
        },
      },
      vertexShader: `\
        #define LOG2 1.442695
        uniform float worldTime;
        uniform float fogDensity;
        // "attribute vec3 wave;
        attribute vec3 color;
        attribute float skyLightmap;
        attribute float torchLightmap;
        // varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vColor;
        varying float vSkyLightmap;
        varying float vTorchLightmap;
        // varying float vFog;

        void main() {
          /* float ang = wave[0];
          float amp = wave[1];
          float speed = wave[2]; */
          // gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y + ((sin(ang + (speed * worldTime))) * amp), position.z, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
          vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
          // vUv = vec2((position.x + position.y) / 16.0 * 4.0, (position.z + position.y) / 16.0 * 4.0 / 16.0);
          vPosition = position;
          vColor = color.rgb;
          vSkyLightmap = skyLightmap;
          vTorchLightmap = torchLightmap;
          // float fogDepth = -mvPosition.z;
          // vFog = 1.0 - exp2( - fogDensity * fogDensity * fogDepth * fogDepth * LOG2 );
        }
      `,
      fragmentShader: `\
        uniform float worldTime;
        uniform sampler2D map;
        uniform vec3 fogColor;
        uniform float sunIntensity;
        // varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vColor;
        varying float vSkyLightmap;
        varying float vTorchLightmap;
        // varying float vFog;
        float speed = 2.0;

        vec4 twoTapSample(
          float tileOffset,
          vec2 tileUV,
          float tileSize,
          sampler2D atlas
        ) {
          //Initialize accumulators
          vec4 color = vec4(0.0, 0.0, 0.0, 0.0);
          float totalWeight = 0.0;

          for(int dx=0; dx<2; ++dx) {
            //Compute coordinate in 2x2 tile patch
            vec2 tileCoord = vec2(2.0 * fract(0.5 * (tileUV.x + float(dx))), tileUV.y);

            //Weight sample based on distance to center
            float w = pow(1.0 - abs(tileCoord.x-1.0), 16.0);

            //Compute atlas coord
            vec2 atlasUV = vec2(tileOffset + tileSize * tileCoord.x, tileCoord.y);

            //Sample and accumulate
            color += w * texture2D(atlas, atlasUV);
            totalWeight += w;
          }

          //Return weighted color
          return color / totalWeight;
        }

        void main() {
          float animationFactor = (speed - abs(mod(worldTime / 1000.0, speed*2.0) - speed)) / speed;
          float frame1 = mod(floor(animationFactor / 16.0), 1.0);
          float frame2 = mod(frame1 + 1.0/16.0, 1.0);
          float mixFactor = fract(animationFactor / 16.0) * 16.0;

          vec2 tileUv = vec2(
            mod(vPosition.x / 4.0, 1.0),
            mod(vPosition.z / 4.0 / 16.0, 1.0)
          );
          vec3 diffuseColor1 = twoTapSample(
            vColor.r,
            tileUv * vec2(1.0, 1.0 - frame1),
            0.25,
            map
          ).rgb;
          vec3 diffuseColor2 = twoTapSample(
            vColor.r,
            tileUv * vec2(1.0, 1.0 - frame2),
            0.25,
            map
          ).rgb;
          vec3 diffuseColor = mix(diffuseColor1, diffuseColor2, mixFactor).rgb;
          // diffuseColor *= (0.2 + 0.8 * sunIntensity);
          // diffuseColor = mix(diffuseColor, fogColor, vFog);

          float lightColor = floor(
            (
              min((vSkyLightmap * sunIntensity) + vTorchLightmap, 1.0)
            ) * 4.0 + 0.5
          ) / 4.0;
          vec3 outgoingLight = diffuseColor * (0.2 + lightColor * 0.8);
          gl_FragColor = vec4(outgoingLight, 0.9);
        }
      `
    };

    return elements.requestElement(GENERATOR_PLUGIN)
      .then(generatorElement => {
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

        const _getChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);
        const _getEtherIndex = (x, y, z) => x + (z * NUM_CELLS_OVERSCAN) + (y * NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN);
        const _getSizedEtherIndex = (x, y, z, sx, sz) => x + (z * sx) + (y * sx * sz);

        const forwardVector = new THREE.Vector3(0, 0, -1);
        const downKmVector = new THREE.Vector3(0, -1024, 0);
        const localVector = new THREE.Vector3();
        const localVector2 = new THREE.Vector3();
        const localVector3 = new THREE.Vector3();
        const localVector4 = new THREE.Vector3();
        const localVector5 = new THREE.Vector3();
        const localCoord = new THREE.Vector2();
        const localCoord2 = new THREE.Vector2();
        const localEuler = new THREE.Euler();
        const localTriangle = new THREE.Triangle();
        const localPlane = new THREE.Plane();
        const localRay = new THREE.Ray();
        const floorPoints = [
          new THREE.Vector3(),
          new THREE.Vector3(),
          new THREE.Vector3(),
          new THREE.Vector3(),
        ];

        const _requestImage = src => new Promise((accept, reject) => {
          const img = new Image();
          img.onload = () => {
            accept(img);
          };
          img.onerror = err => {
            reject(img);
          };
          img.src = src;
        });
        const _requestImageBitmap = src => _requestImage(src)
          .then(img => createImageBitmap(img, 0, 0, img.width, img.height));

        return Promise.all([
          new Promise((accept, reject) => {
            generatorElement.requestOriginHeight(originHeight => {
              world.setSpawnMatrix(new THREE.Matrix4().makeTranslation(0, originHeight, 0));

              accept();
            });
          }),
          _requestImageBitmap('/archae/heightfield/img/liquid.png'),
          sound.requestSfx('archae/heightfield/sfx/underwater.ogg'),
        ])
          .then(([
            setSpawnMatrixResult,
            liquidImg,
            underwaterSfx,
          ]) => {
            const NUM_GEOMETRIES = 4;
            const _makeGeometryBuffer = () => sbffr(
              NUM_POSITIONS_CHUNK,
              (RANGE * RANGE * 2 + RANGE * 2) / NUM_GEOMETRIES,
              [
                {
                  name: 'positions',
                  constructor: Float32Array,
                  size: 3 * 3 * 4,
                },
                {
                  name: 'colors',
                  constructor: Float32Array,
                  size: 3 * 3 * 4,
                },
                {
                  name: 'skyLightmaps',
                  constructor: Uint8Array,
                  size: 3 * 1,
                },
                {
                  name: 'torchLightmaps',
                  constructor: Uint8Array,
                  size: 3 * 1,
                },
                {
                  name: 'indices',
                  constructor: Uint32Array,
                  size: 3 * 4,
                }
              ]
            );
            const geometries = (() => {
              const geometryBuffers = Array(NUM_GEOMETRIES);
              for (let i = 0; i < NUM_GEOMETRIES; i++) {
                geometryBuffers[i] = _makeGeometryBuffer();
              }

              const geometries = Array(NUM_GEOMETRIES);
              for (let i = 0; i < NUM_GEOMETRIES; i++) {
                const geometry = new THREE.BufferGeometry();

                const {positions, colors, skyLightmaps, torchLightmaps, indices} = geometryBuffers[i].getAll();

                const positionAttribute = new THREE.BufferAttribute(positions, 3);
                positionAttribute.dynamic = true;
                geometry.addAttribute('position', positionAttribute);
                const colorAttribute = new THREE.BufferAttribute(colors, 3);
                colorAttribute.dynamic = true;
                geometry.addAttribute('color', colorAttribute);
                const skyLightmapAttribute = new THREE.BufferAttribute(skyLightmaps, 1, true);
                skyLightmapAttribute.dynamic = true;
                geometry.addAttribute('skyLightmap', skyLightmapAttribute);
                const torchLightmapAttribute = new THREE.BufferAttribute(torchLightmaps, 1, true);
                torchLightmapAttribute.dynamic = true;
                geometry.addAttribute('torchLightmap', torchLightmapAttribute);
                const indexAttribute = new THREE.BufferAttribute(indices, 1);
                indexAttribute.dynamic = true;
                geometry.setIndex(indexAttribute);

                renderer.updateAttribute(geometry.attributes.position, 0, geometry.attributes.position.array.length, false);
                renderer.updateAttribute(geometry.attributes.color, 0, geometry.attributes.color.array.length, false);
                renderer.updateAttribute(geometry.attributes.skyLightmap, 0, geometry.attributes.skyLightmap.array.length, false);
                renderer.updateAttribute(geometry.attributes.torchLightmap, 0, geometry.attributes.torchLightmap.array.length, false);
                renderer.updateAttribute(geometry.index, 0, geometry.index.array.length, true);

                geometries[i] = geometry;
              }

              return {
                alloc() {
                  for (let i = 0; i < geometryBuffers.length; i++) {
                    const geometryBuffer = geometryBuffers[i];
                    const gbuffer = geometryBuffer.alloc();
                    if (gbuffer) {
                      gbuffer.geometry = geometries[i];
                      gbuffer.geometryBuffer = geometryBuffer;
                      return gbuffer;
                    }
                  }
                  return null;
                },
                free(gbuffer) {
                  gbuffer.geometryBuffer.free(gbuffer);
                },
              };
            })();

            const _requestTerrainGenerate = (x, z, index, numPositions, numIndices, cb) => {
              generatorElement.requestTerrainGenerate(x, z, index, numPositions, numIndices, cb);
            };
            const _requestTerrainsGenerate = (specs, cb) => {
              generatorElement.requestTerrainsGenerate(specs, cb);
            };
            const _makeMapChunkMeshes = (chunk, gbuffer) => {
              const {index, geometry, slices: {positions, colors, skyLightmaps, torchLightmaps, indices}} = gbuffer;

              const renderListEntries = [
                {
                  object: landObject,
                  geometry,
                  material: heightfieldMaterial,
                  groups: [],
                  visible: false,
                },
                {
                  object: liquidObject,
                  geometry,
                  material: oceanMaterial,
                  groups: [],
                  visible: false,
                },
                {
                  object: liquidObject,
                  geometry,
                  material: oceanMaterial,
                  groups: [],
                  visible: false,
                },
              ];
              let version = 0;

              const meshes = {
                renderListEntries,
                gbuffer,
                index: gbuffer.index,
                numPositions: gbuffer.slices.positions.length,
                numIndices: gbuffer.slices.indices.length,
                skyLightmaps: gbuffer.slices.skyLightmaps,
                torchLightmaps: gbuffer.slices.torchLightmaps,
                // offset: new THREE.Vector2(chunk.x, chunk.z),
                ether: null,
                stckBody: null,
                update: chunkData => {
                  const {positions: newPositions, colors: newColors, skyLightmaps: newSkyLightmaps, torchLightmaps: newTorchLightmaps, indices: newIndices, ether} = chunkData;

                  if (newPositions.length > 0) {
                    version++;

                    // geometry

                    positions.set(newPositions);
                    colors.set(newColors);
                    skyLightmaps.set(newSkyLightmaps);
                    torchLightmaps.set(newTorchLightmaps);
                    indices.set(newIndices);

                    meshes.ether = ether.slice();

                    // XXX preallocate stck buffers
                    if (!meshes.stckBody) {
                      meshes.stckBody = stck.makeStaticEtherfieldBody(
                        new THREE.Vector3(chunk.x * NUM_CELLS, 0, chunk.z * NUM_CELLS),
                        NUM_CELLS,
                        NUM_CELLS_HEIGHT,
                        NUM_CELLS,
                        ether
                      );
                    } else {
                      meshes.stckBody.setData(ether);
                    }

                    const newPositionsLength = newPositions.length;
                    const newColorsLength = newColors.length;
                    const newSkyLightmapsLength = newSkyLightmaps.length;
                    const newTorchLightmapsLength = newTorchLightmaps.length;
                    const newIndicesLength = newIndices.length;

                    const localVersion = version;
                    _requestFrame(next => {
                      if (version === localVersion) {
                        /* renderListEntries[0].visible = false;
                        renderListEntries[1].visible = false;
                        renderListEntries[2].visible = false; */

                        renderer.updateAttribute(geometry.attributes.position, index * positions.length, newPositionsLength, false);
                        renderer.updateAttribute(geometry.attributes.color, index * colors.length, newColorsLength, false);
                        renderer.updateAttribute(geometry.attributes.skyLightmap, index * skyLightmaps.length, newSkyLightmapsLength, false);
                        renderer.updateAttribute(geometry.attributes.torchLightmap, index * torchLightmaps.length, newTorchLightmapsLength, false);
                        renderer.updateAttribute(geometry.index, index * indices.length, newIndicesLength, true);
                        renderer.getContext().flush();

                        requestAnimationFrame(() => {
                          renderListEntries[0].visible = true;
                          renderListEntries[1].visible = true;
                          renderListEntries[2].visible = true;

                          next();
                        });
                      } else {
                        next();
                      }
                    });
                  }
                },
                updateImmediate: chunkData => {
                  const {positions: newPositions, colors: newColors, skyLightmaps: newSkyLightmaps, torchLightmaps: newTorchLightmaps, indices: newIndices, ether} = chunkData;

                  if (newPositions.length > 0) {
                    // geometry

                    positions.set(newPositions);
                    colors.set(newColors);
                    skyLightmaps.set(newSkyLightmaps);
                    torchLightmaps.set(newTorchLightmaps);
                    indices.set(newIndices);

                    meshes.ether = ether.slice();

                    // XXX preallocate stck buffers
                    if (!meshes.stckBody) {
                      meshes.stckBody = stck.makeStaticEtherfieldBody(
                        new THREE.Vector3(chunk.x * NUM_CELLS, 0, chunk.z * NUM_CELLS),
                        NUM_CELLS,
                        NUM_CELLS_HEIGHT,
                        NUM_CELLS,
                        ether
                      );
                    } else {
                      meshes.stckBody.setData(ether);
                    }

                    const newPositionsLength = newPositions.length;
                    const newColorsLength = newColors.length;
                    const newSkyLightmapsLength = newSkyLightmaps.length;
                    const newTorchLightmapsLength = newTorchLightmaps.length;
                    const newIndicesLength = newIndices.length;

                    /* renderListEntries[0].visible = false;
                    renderListEntries[1].visible = false;
                    renderListEntries[2].visible = false; */

                    renderer.updateAttribute(geometry.attributes.position, index * positions.length, newPositionsLength, false);
                    renderer.updateAttribute(geometry.attributes.color, index * colors.length, newColorsLength, false);
                    renderer.updateAttribute(geometry.attributes.skyLightmap, index * skyLightmaps.length, newSkyLightmapsLength, false);
                    renderer.updateAttribute(geometry.attributes.torchLightmap, index * torchLightmaps.length, newTorchLightmapsLength, false);
                    renderer.updateAttribute(geometry.index, index * indices.length, newIndicesLength, true);
                    renderer.getContext().flush();

                    /* renderListEntries[0].visible = true;
                    renderListEntries[1].visible = true;
                    renderListEntries[2].visible = true; */
                  }
                },
                updateLightmap: chunkData => {
                  const {skyLightmaps: newSkyLightmaps, torchLightmaps: newTorchLightmaps} = chunkData;

                  if (newSkyLightmaps.length > 0) {
                    skyLightmaps.set(newSkyLightmaps);
                    torchLightmaps.set(newTorchLightmaps);

                    const newSkyLightmapsLength = newSkyLightmaps.length;
                    const newTorchLightmapsLength = newTorchLightmaps.length;

                    renderer.updateAttribute(geometry.attributes.skyLightmap, index * skyLightmaps.length, newSkyLightmapsLength, false);
                    renderer.updateAttribute(geometry.attributes.torchLightmap, index * torchLightmaps.length, newTorchLightmapsLength, false);
                    renderer.getContext().flush();
                  }
                },
                destroy: () => {
                  version++;

                  geometries.free(gbuffer);

                  if (meshes.stckBody) {
                    stck.destroyBody(meshes.stckBody);
                    meshes.stckBody = null;
                  }
                },
              };
              return meshes;
            };

            const liquidTexture = new THREE.Texture(
              liquidImg,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.NearestFilter,
              THREE.LinearMipMapLinearFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              16
            );
            liquidTexture.needsUpdate = true;
            const oceanMaterial = new THREE.ShaderMaterial({
              uniforms: (() => {
                const uniforms = THREE.UniformsUtils.clone(OCEAN_SHADER.uniforms);
                uniforms.map.value = liquidTexture;
                // uniforms.fogColor.value = scene.fog.color;
                // uniforms.fogDensity.value = scene.fog.density;
                return uniforms;
              })(),
              vertexShader: OCEAN_SHADER.vertexShader,
              fragmentShader: OCEAN_SHADER.fragmentShader,
              // side: THREE.DoubleSide,
              transparent: true,
              polygonOffset: true,
              polygonOffsetFactor: -1,
              polygonOffsetUnits: -1,
            });
            /* oceanMaterial.blending = THREE.CustomBlending;
            oceanMaterial.blendEquation = THREE.AddEquation;
            oceanMaterial.blendSrc = THREE.SrcAlphaFactor;/
            oceanMaterial.blendDst = THREE.ZeroFactor; */
            oceanMaterial.uniformsNeedUpdate = _uniformsNeedUpdateOcean;

            let mapChunkMeshes = {};

            const landObject = (() => {
              const mesh = new THREE.Object3D();
              mesh.updateModelViewMatrix = _updateModelViewMatrix;
              mesh.updateNormalMatrix = _updateNormalMatrix;
              mesh.renderList = [];
              return mesh;
            })();
            scene.add(landObject);
            const liquidObject = (() => {
              const mesh = new THREE.Object3D();
              mesh.updateModelViewMatrix = _updateModelViewMatrix;
              mesh.updateNormalMatrix = _updateNormalMatrix;
              mesh.renderList = [];
              return mesh;
            })();
            scene.add(liquidObject);

            const heightfieldMaterial = new THREE.ShaderMaterial({
              uniforms: (() => {
                const uniforms = Object.assign(
                  THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
                  THREE.UniformsUtils.clone(HEIGHTFIELD_SHADER.uniforms)
                );
                // uniforms.fogColor.value = scene.fog.color;
                // uniforms.fogDensity.value = scene.fog.density;
                return uniforms;
              })(),
              vertexShader: HEIGHTFIELD_SHADER.vertexShader,
              fragmentShader: HEIGHTFIELD_SHADER.fragmentShader,
              lights: true,
              extensions: {
                derivatives: true,
              },
            });
            heightfieldMaterial.uniformsNeedUpdate = _uniformsNeedUpdateHeightfield;

            let running = false;
            const queue = [];
            const _next = () => {
              running = false;

              if (queue.length > 0) {
                queue.shift()();
              }
            };
            const _addChunk = chunk => {
              if (!running) {
                running = true;

                const {x, z} = chunk;
                const index = _getChunkIndex(x, z);
                const oldMapChunkMeshes = mapChunkMeshes[index];
                if (oldMapChunkMeshes) {
                  // heightfieldObject.renderList.splice(heightfieldObject.renderList.indexOf(oldMapChunkMeshes.renderListEntries[0]), 3);

                  oldMapChunkMeshes.destroy();

                  mapChunkMeshes[index] = null;
                }

                const gbuffer = geometries.alloc();
                _requestTerrainGenerate(x, z, gbuffer.index, gbuffer.slices.positions.length, gbuffer.slices.indices.length, chunkData => {
                  const newMapChunkMeshes = _makeMapChunkMeshes(chunk, gbuffer);
                  newMapChunkMeshes.update(chunkData);

                  // heightfieldObject.renderList.push(newMapChunkMeshes.renderListEntries[0], newMapChunkMeshes.renderListEntries[1], newMapChunkMeshes.renderListEntries[2]);

                  mapChunkMeshes[index] = newMapChunkMeshes;
                  chunk[dataSymbol] = newMapChunkMeshes;

                  _next();
                });
              } else {
                queue.push(_addChunk.bind(this, chunk));
              }
            };
            const _removeChunk = chunk => {
              if (!running) {
                running = true;

                const {x, z, [dataSymbol]: oldMapChunkMeshes} = chunk;
                // heightfieldObject.renderList.splice(heightfieldObject.renderList.indexOf(oldMapChunkMeshes.renderListEntries[0]), 3);

                oldMapChunkMeshes.destroy();

                mapChunkMeshes[_getChunkIndex(x, z)] = null;

                _next();
              } else {
                queue.push(_removeChunk.bind(this, chunk));
              }
            };
            const _refreshChunk = chunk => {
              if (!running) {
                running = true;

                const oldMapChunkMeshes = mapChunkMeshes[_getChunkIndex(chunk.x, chunk.z)];
                const {gbuffer} = oldMapChunkMeshes;
                _requestTerrainGenerate(chunk.x, chunk.z, gbuffer.index, gbuffer.slices.positions.length, gbuffer.slices.indices.length, chunkData => {
                  oldMapChunkMeshes.update(chunkData);

                  _next();
                });
              } else {
                queue.push(_refreshChunk.bind(this, chunk));
              }
            };
            const _refreshChunks = chunks => {
              if (!running) {
                running = true;

                cullEnabled = false;

                const specs = chunks.map(chunk => {
                  const oldMapChunkMeshes = mapChunkMeshes[_getChunkIndex(chunk.x, chunk.z)];
                  const {gbuffer} = oldMapChunkMeshes;
                  return {
                    x: chunk.x,
                    y: chunk.z,
                    index: gbuffer.index,
                    numPositions: gbuffer.slices.positions.length,
                    numIndices: gbuffer.slices.indices.length,
                  };
                });

                _requestTerrainsGenerate(specs, chunkDatas => {
                  cullEnabled = true;

                  for (let i = 0; i < chunkDatas.length; i++) {
                    const chunkData = chunkDatas[i];
                    const spec = specs[i];
                    const oldMapChunkMeshes = mapChunkMeshes[_getChunkIndex(spec.x, spec.y)];
                    oldMapChunkMeshes.updateImmediate(chunkData);

                    const {geometries} = chunkData;
                    for (let j = 0; j < NUM_CHUNKS_HEIGHT; j++) {
                      const geometry = geometries[j];
                      const {indexRange} = geometry;
                      const {landStart, landCount, waterStart, waterCount, lavaStart, lavaCount} = indexRange;
                    }

                    const {index, numIndices} = spec;
                    const indexOffset = index * numIndices;
                    oldMapChunkMeshes.renderListEntries[0].groups = geometries.map(geometry => {
                      const {indexRange} = geometry;
                      const {landStart, landCount} = indexRange;
                      return {
                        start: landStart + indexOffset,
                        count: landCount,
                        materialIndex: 0,
                      };
                    });
                    oldMapChunkMeshes.renderListEntries[1].groups = geometries.map(geometry => {
                      const {indexRange} = geometry;
                      const {waterStart, waterCount} = indexRange;
                      return {
                        start: waterStart + indexOffset,
                        count: waterCount,
                        materialIndex: 0,
                      };
                    });
                    oldMapChunkMeshes.renderListEntries[2].groups = geometries.map(geometry => {
                      const {indexRange} = geometry;
                      const {lavaStart, lavaCount} = indexRange;
                      return {
                        start: lavaStart + indexOffset,
                        count: lavaCount,
                        materialIndex: 0,
                      };
                    });
                  }

                  _next();
                });
              } else {
                queue.push(_refreshChunks.bind(this, chunks));
              }
            };

            const a = new THREE.Vector3();
            const b = new THREE.Vector3();
            const c = new THREE.Vector3();
            const p = new THREE.Vector3();
            const triangle = new THREE.Triangle(a, b, c);
            const baryCoord = new THREE.Vector3();

            let frameRunning = false;
            const frameQueue = [];
            const _requestFrame = fn => {
              if (!frameRunning) {
                frameRunning = true;

                fn(() => {
                  frameRunning = false;

                  if (frameQueue.length > 0) {
                    _requestFrame(frameQueue.shift());
                  }
                });
              } else {
                frameQueue.push(fn);
              }
            };

            const heightfieldEntity = {
              entityAddedCallback(entityElement) {
                /* const _teleportTarget = (position, rotation, scale, side, hmdPosition) => {
                  localEuler.setFromQuaternion(rotation, camera.rotation.order);
                  const angleFactor = Math.min(Math.pow(Math.max(localEuler.x + Math.PI * 0.45, 0) / (Math.PI * 0.8), 2), 1);
                  localEuler.x = 0;
                  localEuler.z = 0;
                  const targetPosition = localVector.set(position.x, 0, position.z)
                    .add(
                      localVector2.copy(forwardVector)
                        .applyEuler(localEuler)
                        .multiplyScalar(15 * angleFactor)
                    );
                  const ox = Math.floor(targetPosition.x / NUM_CELLS);
                  const oz = Math.floor(targetPosition.z / NUM_CELLS);
                  const mapChunkMesh = mapChunkMeshes[_getChunkIndex(ox, oz)];

                  if (mapChunkMesh) {
                    targetPosition.y = _getBestHeightfieldTriangleElevation(
                      mapChunkMesh.heightfield,
                      targetPosition.x - (ox * NUM_CELLS),
                      targetPosition.z - (oz * NUM_CELLS),
                      hmdPosition.y - 1.5
                    );
                    if (targetPosition.y !== -1024) {
                      return targetPosition;
                    } else {
                      return null;
                    }
                  } else {
                    return null;
                  }
                };
                teleport.addTarget(_teleportTarget); */

                entityElement.requestFrame = _requestFrame;

                entityElement._cleanup = () => {
                  // teleport.removeTarget(_teleportTarget);
                };
              },
            };
            elements.registerEntity(this, heightfieldEntity);

            /* const _triggerdown = e => {
              const {side} = e;
              const {hmd, gamepads} = pose.getStatus();
              const {worldPosition: hmdPosition} = hmd;
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;

              localEuler.setFromQuaternion(controllerRotation, camera.rotation.order);
              const angleFactor = Math.min(Math.pow(Math.max(localEuler.x + Math.PI * 0.45, 0) / (Math.PI * 0.8), 2), 1);
              localEuler.x = 0;
              localEuler.z = 0;
              localVector.set(controllerPosition.x, 0, controllerPosition.z)
                .add(
                  localVector2.copy(forwardVector)
                    .applyEuler(localEuler)
                    .multiplyScalar(15 * angleFactor)
                );
              const {x: lx, z: lz} = localVector;
              const ox = Math.floor(lx / NUM_CELLS);
              const oz = Math.floor(lz / NUM_CELLS);

              const mapChunkMesh = mapChunkMeshes[_getChunkIndex(ox, oz)];
              if (mapChunkMesh) {
                const ly = _getBestHeightfieldTriangleElevation(
                  mapChunkMesh.heightfield,
                  lx - (ox * NUM_CELLS),
                  lz - (oz * NUM_CELLS),
                  hmdPosition.y - 1.5
                );
                if (ly !== -1024) {
                  generatorElement.subVoxel(Math.round(lx), Math.round(ly), Math.round(lz));

                  e.stopImmediatePropagation();
                }
              }
            };
            input.on('triggerdown', _triggerdown, {
              priority: -1,
            }); */

            const _requestCull = (hmdPosition, projectionMatrix, matrixWorldInverse, cb) => {
              generatorElement.requestTerrainCull(hmdPosition, projectionMatrix, matrixWorldInverse, cb);
            };
            let cullEnabled = true;
            const _debouncedRefreshCull = _debounce(next => {
              const {hmd} = pose.getStatus();
              const {worldPosition: hmdPosition} = hmd;
              const {projectionMatrix, matrixWorldInverse} = camera;
              _requestCull(hmdPosition, projectionMatrix, matrixWorldInverse, culls => {
                if (cullEnabled) {
                  const [landCulls, liquidCulls] = culls;

                  let landRenderListIndex = 0;
                  for (let i = 0; i < landCulls.length; i++) {
                    const {index, land} = landCulls[i];

                    const trackedMapChunkMeshes = mapChunkMeshes[index];
                    if (trackedMapChunkMeshes) {
                      trackedMapChunkMeshes.renderListEntries[0].groups = land;
                      landObject.renderList[landRenderListIndex++] = trackedMapChunkMeshes.renderListEntries[0];
                    }
                  }
                  landObject.renderList.length = landRenderListIndex;

                  let liquidRenderListIndex = 0;
                  for (let i = 0; i < liquidCulls.length; i++) {
                    const {index, water, lava} = liquidCulls[i];

                    const trackedMapChunkMeshes = mapChunkMeshes[index];
                    if (trackedMapChunkMeshes) {
                      trackedMapChunkMeshes.renderListEntries[1].groups = water;
                      liquidObject.renderList[liquidRenderListIndex++] = trackedMapChunkMeshes.renderListEntries[1];

                      trackedMapChunkMeshes.renderListEntries[2].groups = lava;
                      liquidObject.renderList[liquidRenderListIndex++] = trackedMapChunkMeshes.renderListEntries[2];
                    }
                  }
                  liquidObject.renderList.length = liquidRenderListIndex;
                }

                next();
              });
            });

            const _add = chunk => {
              _addChunk(chunk);
            };
            generatorElement.on('add', _add);
            const _remove = chunk => {
              _removeChunk(chunk);
            };
            generatorElement.on('remove', _remove);
            const _refresh = chunk => {
              _refreshChunk(chunk);
            };
            generatorElement.on('refresh', _refresh);
            const _refreshes = chunks => {
              _refreshChunks(chunks);
            };
            generatorElement.on('refreshes', _refreshes);
            const _redecorate = ({x, z, decorations}) => {
              const oldMapChunkMeshes = mapChunkMeshes[_getChunkIndex(x, z)];
              if (oldMapChunkMeshes) {
                oldMapChunkMeshes.updateLightmap(decorations.terrain);
              }
            };
            generatorElement.on('redecorate', _redecorate);
            generatorElement.forEachChunk(chunk => {
              _add(chunk);
            });

            let refreshCullTimeout = null;
            const _recurseRefreshCull = () => {
              _debouncedRefreshCull();
              refreshCullTimeout = setTimeout(_recurseRefreshCull, 1000 / 30);
            };
            _recurseRefreshCull();

            let lastBodyUpdateTime = Date.now();
            const _updateBody = () => {
              const now = Date.now();
              const timeDiff = now - lastBodyUpdateTime;

              if (timeDiff > 1000 / 10) {
                const {hadLava, hadWater} = generatorElement.getBodyObject();

                if (hadLava) {
                  const healthElement = elements.getEntitiesElement().querySelector(HEALTH_PLUGIN);
                  if (healthElement) {
                    healthElement.hurt(10);
                  }
                }
                if (hadWater && underwaterSfx.paused) {
                  oceanMaterial.side = THREE.DoubleSide;
                  underwaterSfx.start();
                } else if (!hadWater && !underwaterSfx.paused) {
                  oceanMaterial.side = THREE.FrontSide;
                  underwaterSfx.stop();
                }

                lastBodyUpdateTime = Date.now();
              }
            };
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
              const _updateMaterials = () => {
                const dayNightSkyboxEntity = elements.getEntitiesElement().querySelector(DAY_NIGHT_SKYBOX_PLUGIN);
                const sunIntensity = (dayNightSkyboxEntity && dayNightSkyboxEntity.getSunIntensity) ? dayNightSkyboxEntity.getSunIntensity() : 0;
                heightfieldMaterial.uniforms.sunIntensity.value = sunIntensity;

                oceanMaterial.uniforms.worldTime.value = world.getWorldTime();
                oceanMaterial.uniforms.sunIntensity.value = sunIntensity;
              };

              _updateMaterials();
              _updateBody();
              // _updateMatrices();
            };
            render.on('update', _update);
            const _beforeRender = () => {
              _updateMatrices();
            };
            render.on('beforeRender', _beforeRender);

            pose.addCollider((position, rotation, velocity, oldPosition) => {
              const worldPosition = localVector.copy(position).applyMatrix4(pose.getStageMatrix());
              const ax = Math.floor(worldPosition.x);
              const ay = Math.floor(worldPosition.y);
              const az = Math.floor(worldPosition.z);

              const dims = localVector2.set(5, 5, 5);
              const shift = localVector3.set(ax - 2, ay - 2, az - 2);
              const oldWorldPosition = localVector4.copy(worldPosition);

              const collideResult = generatorElement.collideBoxEther(dims, etherBuffer => {
                etherBuffer = etherBuffer.subarray(0, 5 * 5 * 5);
                etherBuffer.fill(1);
                for (let dx = -2; dx <= 2; dx++) {
                  const x = ax + dx;
                  for (let dz = -2; dz <= 2; dz++) {
                    const z = az + dz;
                    const ox = Math.floor(x / NUM_CELLS);
                    const oz = Math.floor(z / NUM_CELLS);
                    const mapChunkMesh = mapChunkMeshes[_getChunkIndex(ox, oz)];

                    if (mapChunkMesh) {
                      for (let dy = -2; dy <= 2; dy++) {
                        const y = ay + dy;
                        if (y >= 0 && y <= NUM_CELLS_HEIGHT) {
                          const srcIndex = _getEtherIndex(x - ox * NUM_CELLS, y, z - oz * NUM_CELLS);
                          const dstIndex = _getSizedEtherIndex(dx + 2, dy + 2, dz + 2, 5, 5);
                          etherBuffer[dstIndex] = mapChunkMesh.ether[srcIndex];
                        }
                      }
                    }
                  }
                }
              }, shift, worldPosition, velocity);

              if (collideResult) {
                const worldPositionDiff = localVector5.copy(worldPosition).sub(oldWorldPosition);
                position.add(worldPositionDiff);

                return collideResult;
              } else {
                return 0;
              }
            }, {
              priority: 1,
            });

            this._cleanup = () => {
              scene.remove(landObject);
              scene.remove(liquidObject);

              generatorElement.removeListener('add', _add);
              generatorElement.removeListener('remove', _remove);
              clearTimeout(refreshCullTimeout);

              elements.unregisterEntity(this, heightfieldEntity);

              render.removeListener('update', _update);
              render.removeListener('beforeRender', _beforeRender);
            };
          });
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = Heightfield;
