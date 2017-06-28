const indev = require('indev');

const NUM_CELLS = 64;
const NUM_POSITIONS = 30 * 1024;
const CLOUD_RATE = 0.00001;
const CLOUD_SPEED = 2;

const CLOUD_SHADER = {
  uniforms: {
    worldTime: {
      type: 'f',
      value: 0,
    },
    fogColor: {
      type: '3f',
    },
    fogDensity: {
      type: 'f',
    },
  },
  vertexShader: [
    "uniform float worldTime;",
    "varying float fogDepth;",
    "void main() {",
    `  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x - ((worldTime / 1000.0) * ${CLOUD_SPEED.toFixed(8)}), position.y, position.z, 1.0);`,
    "  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
    "  fogDepth = -mvPosition.z;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "#define LOG2 1.442695",
    "#define whiteCompliment(a) ( 1.0 - saturate( a ) )",
		"uniform vec3 fogColor;",
    "uniform float fogDensity;",
    "varying float fogDepth;",
    "void main() {",
    "  gl_FragColor = vec4(1.0, 1.0, 1.0, 0.5);",
    "  float fogFactor = whiteCompliment( exp2( - fogDensity * fogDensity * fogDepth * fogDepth * LOG2 ) );",
    "  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );",
    "}"
  ].join("\n")
};

class Cloud {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, world, utils: {geometry: geometryUtils, random: {alea}}} = zeo;

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
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(NUM_POSITIONS * 3);
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.setDrawRange(0, 0);

          const uniforms = THREE.UniformsUtils.clone(CLOUD_SHADER.uniforms);
          uniforms.fogColor.value = scene.fog.color;
          uniforms.fogDensity.value = scene.fog.density;
          const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: CLOUD_SHADER.vertexShader,
            fragmentShader: CLOUD_SHADER.fragmentShader,
            transparent: true,
            // depthTest: false,
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.frustumCulled = false;
          mesh.clouds = [];
          return mesh;
        })();
        entityObject.add(cloudsMesh);
        entityApi.cloudsMesh = cloudsMesh;

        const _getWorldTime = () => world.getWorldTime();

        let lastMeshTime = _getWorldTime();
        const update = () => {
          const _setCloudMeshFrame = worldTime => {
            cloudsMesh.material.uniforms.worldTime.value = worldTime;
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
                    const basePosition = new THREE.Vector2(ax, ay);
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

            const {geometry: cloudsGeometry} = cloudsMesh;
            const cloudsGeometryPositionAttribute = cloudsGeometry.getAttribute('position');
            const cloudsGeometryPositions = cloudsGeometryPositionAttribute.array;
            let index = 0;
            for (let i = 0; i < clouds.length; i++) {
              const cloud = clouds[i];
              const {basePosition, cloudId} = cloud;

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
                    basePosition.x + (-25 + (cloudRng() * 25)),
                    20 + (-5 + (cloudRng() * 5)),
                    basePosition.y + (-25 + (cloudRng() * 25))
                  ));
                points.push(geometry.getAttribute('position').array);
              }

              for (let i = 0; i < points.length; i++) {
                const point = points[i];
                cloudsGeometryPositions.set(point, index);
                index += point.length;
              }
            }
            cloudsGeometryPositionAttribute.needsUpdate = true;
            cloudsGeometry.setDrawRange(0, index);

            cloudsMesh.clouds = clouds;
          };

          const nextWorldTime = _getWorldTime();

          _setCloudMeshFrame(nextWorldTime);

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
      elements.unregisterEntity(this, cloudEntity);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Cloud;
