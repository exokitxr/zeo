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
    const gravity = -9.8 / 100;
    const fireworkSpeed = 0.2;
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
        varying vec2 vUv;
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

          gl_Position = projectionMatrix * modelView * vec4(position.xyz, 1.0);
          vUv = uv;
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
        float speed = 2.0;

        void main() {
          float animationFactor = (speed - abs(mod(worldTime / 1000.0, speed*2.0) - speed)) / speed;
          float frame1 = mod(floor(animationFactor / 16.0), 1.0);
          float frame2 = mod(frame1 + 1.0/16.0, 1.0);
          float mixFactor = fract(animationFactor / 16.0) * 16.0;

          vec4 diffuseColor1 = texture2D(map, vUv * vec2(1.0, 1.0 - frame1));
          vec4 diffuseColor2 = texture2D(map, vUv * vec2(1.0, 1.0 - frame2));
          vec4 diffuseColor = mix(diffuseColor1, diffuseColor2, mixFactor);

          // gl_FragColor = diffuseColor;
          gl_FragColor = vec4(1.0, 0.5, 0.5, 1.0);
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

    const particleGeometry = (() => {
      const geometry = new THREE.PlaneBufferGeometry(1, 1);
      /* const colors = new Float32Array(geometry.getAttribute('position').array.length);
      geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
      const numColors = colors.length / 3;
      for (let i = 0; i < numColors; i++) {
        const baseIndex = i * 3;
        colors[baseIndex + 0] = fireworkColor.r;
        colors[baseIndex + 1] = fireworkColor.g;
        colors[baseIndex + 2] = fireworkColor.b;
      } */
      return geometry;
    })();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return _requestUpdateTextureAtlas()
      .then(() => {
        if (live) {
          class Particle {
            constructor(position, uvs, velocity, startTime, endTime) {
              this.position = position;
              this.uvs = uvs;
              this.velocity = velocity;
              this.startTime = startTime;
              this.endTime = endTime;
            }
          }
          const particles = [];

          const uniforms = THREE.UniformsUtils.clone(PARTICLE_SHADER.uniforms);
          const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: PARTICLE_SHADER.vertexShader,
            fragmentShader: PARTICLE_SHADER.fragmentShader,
            // side: THREE.DoubleSide,
            transparent: true,
          });

          const particleGeometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.02);
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
          const uvs = new Float32Array(NUM_POSITIONS);
          const uvsAttribute = new THREE.BufferAttribute(uvs, 2);
          geometry.addAttribute('uv', uvsAttribute);
          const velocities = new Float32Array(NUM_POSITIONS);
          const velocitiesAttribute = new THREE.BufferAttribute(velocities, 3);
          geometry.addAttribute('velocity', velocitiesAttribute);
          const startTimes = new Float32Array(NUM_POSITIONS);
          const startTimesAttribute = new THREE.BufferAttribute(startTimes, 1);
          geometry.addAttribute('startTime', startTimesAttribute);
          const indices = new Uint16Array(NUM_POSITIONS / 3);
          const indexAttribute = new THREE.BufferAttribute(indices, 1);
          geometry.setIndex(indexAttribute);
          geometry.setDrawRange(0, 0);
          const particlesMesh = new THREE.Mesh(geometry, material);
          particlesMesh.frustumCulled = false;

          setInterval(() => {
            particles.length = 0;

            const startTime = Date.now();

            const numParticles = Math.floor(200 + Math.random() * 200);
            for (let j = 0; j < numParticles; j++) {
              const endTime = startTime + 1500 + Math.random() * 1500;
              const particle = new Particle(
                new THREE.Vector3(0, 68, 0).add(
                  new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 0.2)
                ),
                _getUv('explosion'),
                new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 0.2),
                startTime,
                endTime
              );
              particles.push(particle);
            }
          }, 2000);

          let lastUpdateTime = Date.now();
          const _update = () => {
            const now = Date.now();
            const timeDiff = (now - lastUpdateTime) / 1000;

            const _updateParticles = () => {
              if (particles.length > 0) {
                const removedParticles = [];
                for (let i = 0; i < particles.length; i++) {
                  const particle = particles[i];
                  const {endTime} = particle;

                  if (now < endTime) {
                    const {position, velocity} = particle;
                    position.add(velocity);
                    velocity.y += gravity * timeDiff;
                  } else {
                    removedParticles.push(particle);
                  }
                }
                for (let i = 0; i < removedParticles.length; i++) {
                  particles.splice(particles.indexOf(removedParticles[i]), 1);
                }
              }
            };
            const _renderParticles = () => {
              let attributeIndex = 0;
              let uvIndex = 0;
              let velocityIndex = 0;
              let startTimeIndex = 0;
              let indexIndex = 0;

              for (let i = 0; i < particles.length; i++) {
                const {position, uvs, velocity, startTime} = particles[i];
                const uvWidth = uvs[2] - uvs[0];
                const uvHeight = uvs[3] - uvs[1];
                const newGeometryPositions = particleGeometryPositions;
                const newGeometryUvs = particleGeometryUvs;
                const newGeometryIndices = particleGeometryIndices;

                for (let j = 0; j < numParticleGeometryPositions; j++) {
                  const basePositionIndex = attributeIndex + j * 3;
                  const srcBasePositionIndex = j * 3;
                  positions[basePositionIndex + 0] = newGeometryPositions[srcBasePositionIndex + 0] + position.x;
                  positions[basePositionIndex + 1] = newGeometryPositions[srcBasePositionIndex + 1] + position.y;
                  positions[basePositionIndex + 2] = newGeometryPositions[srcBasePositionIndex + 2] + position.z;

                  const baseUvIndex = uvIndex + j * 2;
                  const srcBaseUvIndex = j * 2;
                  uvs[baseUvIndex + 0] = uvs[0] + newGeometryUvs[srcBaseUvIndex + 0] * uvWidth;
                  uvs[baseUvIndex + 1] = uvs[1] + newGeometryUvs[srcBaseUvIndex + 1] * uvHeight;

                  velocity[basePositionIndex + 0] = velocity.x;
                  velocity[basePositionIndex + 1] = velocity.y;
                  velocity[basePositionIndex + 2] = velocity.z;

                  const baseStartTimeIndex = startTimeIndex + j;
                  startTimes[basePositionIndex] = now;
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
              uvsAttribute.needsUpdate = true;
              velocitiesAttribute.needsUpdate = true;
              startTimesAttribute.needsUpdate = true;
              indexAttribute.needsUpdate = true;
            };
            const _updateParticlesMesh = () => {
              if (particles.length > 0 && !particlesMesh.parent) {
                scene.add(particlesMesh);
              } else if (particles.length === 0 && particlesMesh.parent) {
                scene.remove(particlesMesh);
              }
            };
            const _updateMaterials = () => {
              material.uniforms.worldTime.value = world.getWorldTime();
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
