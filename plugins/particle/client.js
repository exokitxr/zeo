const {
  TEXTURE_SIZE,
} = require('./lib/constants/constants');

const NUM_POSITIONS = 100 * 1024;

class Particle {
  mount() {
    const {three, elements, pose, input, render, items, world, utils: {hash: hashUtils}} = zeo;
    const {THREE, scene} = three;
    const {murmur} = hashUtils;

    const oneVector = new THREE.Vector3(1, 1, 1);
    const particleOffsetVector = new THREE.Vector3(0, -0.2/2, 0);
    const gravity = -9.8 / 1000 / 1000;
    const explosionTime = 1000;
    const localVector = new THREE.Vector3();
    const localQuaternion = new THREE.Quaternion();
    const localEuler = new THREE.Euler();

    const PARTICLE_SHADER = {
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
        uniform float worldTime;
        attribute vec3 delta;
        attribute vec3 velocity;
        attribute float startTime;
        attribute float endTime;
        varying vec2 vUv;
        varying float vStartTime;
        varying float vEndTime;
        void main() {
          mat4 modelView = modelViewMatrix;
          modelView[0][0] = 1.0;
          modelView[0][1] = 0.0;
          modelView[0][2] = 0.0;
          modelView[1][0] = 0.0;
          modelView[1][1] = 1.0;
          modelView[1][2] = 0.0;
          modelView[2][0] = 0.0;
          modelView[2][1] = 0.0;
          modelView[2][2] = 1.0;
          modelView[3][0] = 0.0;
          modelView[3][1] = 0.0;
          modelView[3][2] = 0.0;
          modelView[3][3] = 1.0;

          float animationFactor = (worldTime - startTime) / (endTime - startTime);
          gl_Position = projectionMatrix * vec4(
            (modelViewMatrix * vec4(position.xyz + (velocity * 8.0 * pow(animationFactor, 0.4)), 1.0)).xyz +
            (modelView * vec4(delta, 1.0)).xyz,
            1.0
          );
          vUv = uv;
          vStartTime = startTime;
          vEndTime = endTime;
        }
      `,
      fragmentShader: `\
        #define LOG2 1.442695
        #define whiteCompliment(a) ( 1.0 - saturate( a ) )
        uniform float worldTime;
        uniform sampler2D map;
        uniform vec3 fogColor;
        uniform float fogDensity;
        varying vec2 vUv;
        varying float vStartTime;
        varying float vEndTime;
        float speed = 2.0;
        float tileSize = 480.0 / 512.0;
        float numFrames = 30.0;

        void main() {
          float animationFactor = (worldTime - vStartTime) / (vEndTime - vStartTime);
          float frame1 = mod(floor(animationFactor * numFrames), numFrames);
          float frame2 = mod(frame1 + 1.0, numFrames);
          float mixFactor = fract(animationFactor / numFrames) * numFrames;

          vec4 diffuseColor1 = texture2D(map, vUv * vec2(1.0, tileSize / numFrames) + vec2(0.0, 1.0 - (tileSize * frame1 / numFrames)));
          vec4 diffuseColor2 = texture2D(map, vUv * vec2(1.0, tileSize / numFrames) + vec2(0.0, 1.0 - (tileSize * frame2 / numFrames)));
          vec4 diffuseColor = mix(diffuseColor1, diffuseColor2, mixFactor);

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

    const _requestUpdateTextureAtlas = () => Promise.all([
      fetch(`/archae/particle/texture-atlas.png`, {
        credentials: 'include',
      })
      .then(_resBlob)
      .then(blob => createImageBitmap(blob, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE, {
        imageOrientation: 'flipY',
      })),
      fetch(`/archae/particle/texture-uvs.json`, {
        credentials: 'include',
      })
      .then(_resJson),
    ])
      .then(([
        imageBitmap,
        newTextureUvs,
      ]) => {
        textureAtlas.image = imageBitmap;
        textureAtlas.needsUpdate = true;
        textureUvs = newTextureUvs;
      });

    const textureAtlas = new THREE.Texture(
      null,
      THREE.UVMapping,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
      THREE.NearestFilter,
      THREE.LinearMipMapLinearFilter,
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
          class Particle {
            constructor(position, uv, velocity, startTime, endTime) {
              this.position = position;
              this.uv = uv;
              this.velocity = velocity;
              this.startTime = startTime;
              this.endTime = endTime;
            }
          }
          const particles = [];

          const uniforms = THREE.UniformsUtils.clone(PARTICLE_SHADER.uniforms);
          uniforms.map.value = textureAtlas;
          const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: PARTICLE_SHADER.vertexShader,
            fragmentShader: PARTICLE_SHADER.fragmentShader,
            // side: THREE.DoubleSide,
            transparent: true,
          });

          const particleGeometry = new THREE.PlaneBufferGeometry(2, 2);
          const particleGeometryPositions = particleGeometry.getAttribute('position').array;
          const numParticleGeometryPositions = particleGeometryPositions.length / 3;
          const particleGeometryUvs = particleGeometry.getAttribute('uv').array;
          const numParticleGeometryUvs = particleGeometryUvs.length / 2;
          const particleGeometryIndices = particleGeometry.index.array;
          const numParticleGeometryIndices = particleGeometryIndices.length;

          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(NUM_POSITIONS);
          const positionsAttribute = new THREE.BufferAttribute(positions, 3);
          geometry.addAttribute('position', positionsAttribute);
          const deltas = new Float32Array(NUM_POSITIONS);
          const deltasAttribute = new THREE.BufferAttribute(deltas, 3);
          geometry.addAttribute('delta', deltasAttribute);
          const uvs = new Float32Array(NUM_POSITIONS);
          const uvsAttribute = new THREE.BufferAttribute(uvs, 2);
          geometry.addAttribute('uv', uvsAttribute);
          const velocities = new Float32Array(NUM_POSITIONS);
          const velocitiesAttribute = new THREE.BufferAttribute(velocities, 3);
          geometry.addAttribute('velocity', velocitiesAttribute);
          const startTimes = new Float32Array(NUM_POSITIONS);
          const startTimesAttribute = new THREE.BufferAttribute(startTimes, 1);
          geometry.addAttribute('startTime', startTimesAttribute);
          const endTimes = new Float32Array(NUM_POSITIONS);
          const endTimesAttribute = new THREE.BufferAttribute(endTimes, 1);
          geometry.addAttribute('endTime', endTimesAttribute);
          const indices = new Uint16Array(NUM_POSITIONS / 3);
          const indexAttribute = new THREE.BufferAttribute(indices, 1);
          geometry.setIndex(indexAttribute);
          geometry.setDrawRange(0, 0);
          const particlesMesh = new THREE.Mesh(geometry, material);
          particlesMesh.frustumCulled = false;

          const _getWorldTime = (() => {
            let worldTimeOffset = 0;
            return () => {
              const worldTime = world.getWorldTime();
              if (particles.length === 0) {
                worldTimeOffset = worldTime;
                return 0;
              } else {
                return worldTime - worldTimeOffset;
              }
            };
          })();

          let particlesNeedsUpdate = false;

          setInterval(() => {
            particles.length = 0;

            const startTime = _getWorldTime();

            const numParticles = 300;
            for (let j = 0; j < numParticles; j++) {
              const endTime = startTime + explosionTime * (0.75 + Math.random() * 0.75);
              const particle = new Particle(
                new THREE.Vector3(0, 68, 0),
                _getUv(Math.random() < 0.5 ? 'explosion' : 'smoke'),
                new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
                  .multiplyScalar(Math.random()),
                startTime,
                endTime
              );
              particles.push(particle);
            }
            particlesNeedsUpdate = true;
          }, 2000);

          let lastUpdateTime = _getWorldTime();
          const _update = () => {
            const now = _getWorldTime();
            const timeDiff = now - lastUpdateTime;

            const _updateParticles = () => {
              if (particles.length > 0) {
                const removedParticles = [];
                for (let i = 0; i < particles.length; i++) {
                  const particle = particles[i];
                  const {endTime} = particle;

                  if (now >= endTime) {
                    removedParticles.push(particle);
                  }
                }
                if (removedParticles.length > 0) {
                  for (let i = 0; i < removedParticles.length; i++) {
                    particles.splice(particles.indexOf(removedParticles[i]), 1);
                  }
                  particlesNeedsUpdate = true;
                }
              }
            };
            const _renderParticles = () => {
              if (particlesNeedsUpdate) {
                let attributeIndex = 0;
                let uvIndex = 0;
                let velocityIndex = 0;
                let startTimeIndex = 0;
                let indexIndex = 0;

                for (let i = 0; i < particles.length; i++) {
                  const {position, uv, velocity, startTime, endTime} = particles[i];
                  const uvWidth = uv[2] - uv[0];
                  const uvHeight = uv[3] - uv[1];
                  const newGeometryPositions = particleGeometryPositions;
                  const newGeometryUvs = particleGeometryUvs;
                  const newGeometryIndices = particleGeometryIndices;

                  for (let j = 0; j < numParticleGeometryPositions; j++) {
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
                    uvs[baseUvIndex + 0] = uv[0] + newGeometryUvs[srcBaseUvIndex + 0] * uvWidth;
                    uvs[baseUvIndex + 1] = 1 - (uv[1] + newGeometryUvs[srcBaseUvIndex + 1] * uvHeight);

                    velocities[basePositionIndex + 0] = velocity.x;
                    velocities[basePositionIndex + 1] = velocity.y;
                    velocities[basePositionIndex + 2] = velocity.z;

                    const baseStartTimeIndex = startTimeIndex + j;
                    startTimes[baseStartTimeIndex] = startTime;
                    endTimes[baseStartTimeIndex] = endTime;
                  }

                  for (let j = 0; j < numParticleGeometryIndices; j++) {
                    const baseIndex = indexIndex + j;
                    const baseAttributeIndex = attributeIndex / 3;
                    indices[baseIndex] = newGeometryIndices[j] + baseAttributeIndex;
                  }

                  attributeIndex += numParticleGeometryPositions * 3;
                  uvIndex += numParticleGeometryUvs * 2;
                  velocityIndex += numParticleGeometryPositions * 3;
                  startTimeIndex += numParticleGeometryPositions;
                  indexIndex += numParticleGeometryIndices;
                }
                geometry.setDrawRange(0, indexIndex);

                positionsAttribute.needsUpdate = true;
                deltasAttribute.needsUpdate = true;
                uvsAttribute.needsUpdate = true;
                velocitiesAttribute.needsUpdate = true;
                startTimesAttribute.needsUpdate = true;
                endTimesAttribute.needsUpdate = true;
                indexAttribute.needsUpdate = true;

                particlesNeedsUpdate = false;
              }
            };
            const _updateParticlesMesh = () => {
              if (particles.length > 0 && !particlesMesh.parent) {
                scene.add(particlesMesh);
              } else if (particles.length === 0 && particlesMesh.parent) {
                scene.remove(particlesMesh);
              }
            };
            const _updateMaterials = () => {
              material.uniforms.worldTime.value = _getWorldTime();
            };

            _updateParticles();
            _renderParticles();
            _updateParticlesMesh();
            _updateMaterials();

            lastUpdateTime = now;
          };
          render.on('update', _update);

          this._cleanup = () => {
            geometry.dispose();
            material.dispose();

            if (particlesMesh.parent) {
              scene.remove(particlesMesh);
            }

            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Particle;
