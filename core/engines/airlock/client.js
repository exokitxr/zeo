const FLOOR_SIZE = 1024;
const GRID_SIZE = 128;
const GRID_RESOLUTION = 4;
const TARGET_RADII = [1, 2, 4, 8, 16, 32, 64, 128, 256];

const FLOOR_COLOR = 0xAAAAAA;
const LINE_COLOR = 0xCCCCCC;
const DOT_COLOR = 0x808080;

const SHADOW_MAP_SIZE = 2048;

// const FACES = ['top', 'bottom', 'left', 'right', 'front', 'back'];
const FACES = ['back', 'left', 'front', 'right', 'top', 'bottom'];

class Airlock {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {home: {url: homeUrl, enabled: homeEnabled}, server: {url: serverUrl, enabled: serverEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImage = p => new Promise((accept, reject) => {
      const img = new Image();
      const url = (() => {
        if (homeEnabled) {
          return homeUrl;
        } else if (serverEnabled) {
          return serverUrl;
        } else {
          return null;
        }
      })();
      img.src = 'https://' + url + p;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });
    /* const _requestCubeMapImgs = () => {
      if (serverEnabled) {
        return Promise.all(FACES.map(face => _requestImage('/servers/img/cubemap-' + face + '.png')))
          .then(cubeMapImgs => {
            const result = {};
            for (let i = 0; i < cubeMapImgs.length; i++) {
              const cubeMapImg = cubeMapImgs[i];
              const face = FACES[i];
              result[face] = cubeMapImg;
            }
            return result;
          });
      } else {
        return Promise.resolve();
      }
    }; */
    const _requestCubeMapImgs = () => Promise.all(FACES.map((face, index) => _requestImage('/archae/airlock/img/skybox-' + (index + 1) + '.png')))
      .then(cubeMapImgs => {
        const result = {};
        for (let i = 0; i < cubeMapImgs.length; i++) {
          const cubeMapImg = cubeMapImgs[i];
          const face = FACES[i];
          result[face] = cubeMapImg;
        }
        return result;
      });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/config',
        '/core/utils/geometry-utils',
      ]),
      _requestCubeMapImgs(),
    ]).then(([
      [
        three,
        config,
        geometryUtils,
      ],
      cubeMapImgs,
    ]) => {
      if (live) {
        const {THREE, scene} = three;

        const mesh = (() => {
          const object = new THREE.Object3D();

          const axisMesh = (() => {
            const geometry = (() => {
              const result = new THREE.BufferGeometry();
              const positions = Float32Array.from([
                0, 0, 0,
                1, 0, 0,
                0, 0, 0,
                0, 1, 0,
                0, 0, 0,
                0, 0, 1,
              ]);
              result.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              const colors = Float32Array.from([
                1, 0, 0,
                1, 0, 0,
                0, 1, 0,
                0, 1, 0,
                0, 0, 1,
                0, 0, 1,
              ]);
              result.addAttribute('color', new THREE.BufferAttribute(colors, 3));
              return result;
            })();
            const material = new THREE.LineBasicMaterial({
              vertexColors: THREE.VertexColors,
            });

            const mesh = new THREE.LineSegments(geometry, material);
            // mesh.polygonOffset = true;
            // mesh.polygonOffsetFactor = 2;
            return mesh;
          })();
          object.add(axisMesh);

          const gridMesh = (() => {
            const width = GRID_SIZE;
            const depth = GRID_SIZE;
            const resolution = GRID_RESOLUTION;

            const positions = new Float32Array(
              (4 * 4 * resolution * resolution * 3) +
              (16 * 16 * (resolution / 2) * (resolution / 2) * 3) +
              (64 * 64 * (resolution / 4) * (resolution / 4) * 3) +
              (width * depth * (resolution / 8) * (resolution / 8) * 3)
            );
            let baseIndex = 0;
            [
              [4, 4, resolution],
              [16, 16, resolution / 2],
              [64, 64, resolution / 4],
              [width, depth, resolution / 8],
            ].forEach(([width, depth, resolution]) => {
              for (let i = 0; i < (width * resolution); i++) {
                for (let j = 0; j < (depth * resolution); j++) {
                  const x = -(width / 2) + (i / resolution);
                  const y = 0.01;
                  const z = -(depth / 2) + (j / resolution);

                  positions[baseIndex + 0] = x;
                  positions[baseIndex + 1] = y;
                  positions[baseIndex + 2] = z;

                  baseIndex += 3;
                }
              }
            });

            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));

            const material = new THREE.PointsMaterial({
              color: DOT_COLOR,
              size: 0.015,
            });

            const mesh = new THREE.Points(geometry, material);
            return mesh;
          })();
          object.add(gridMesh);

          const floorMesh = (() => {
            const geometry = new THREE.PlaneBufferGeometry(FLOOR_SIZE, FLOOR_SIZE);
            geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
            geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.1, 0));

            const material = new THREE.MeshPhongMaterial({
              color: FLOOR_COLOR,
              shininess: 10,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            return mesh;
          })();
          object.add(floorMesh);

          const targetMesh = (() => {
            const geometry = (() => {
              const radii = TARGET_RADII;
              const segments = 8;
              const numVerticesPerRadius = segments * 9;

              const positions = new Float32Array(radii.length * numVerticesPerRadius);
              for (let i = 0; i < radii.length; i++) {
                const radius = radii[i];
                const circleGeometry = new THREE.CircleBufferGeometry(radius, segments, 0, Math.PI * 2);
                geometryUtils.unindexBufferGeometry(circleGeometry);
                positions.set(circleGeometry.attributes.position.array, i * numVerticesPerRadius);
              }

              const geometry = new THREE.BufferGeometry();
              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
              // geometry.applyMatrix(new THREE.Matrix4().makeRotationY((0.5 + (1 / 28)) * (Math.PI * 2)));
              return geometry;
            })();

            const material = new THREE.MeshBasicMaterial({
              color: LINE_COLOR,
              wireframe: true,
              depthWrite: false,
              // opacity: 0.5,
              // transparent: true,
              // depthTest: false,
            });

            const mesh = new THREE.LineSegments(geometry, material);
            return mesh;
          })();
          object.add(targetMesh);

          /* const domeMesh = (() => {
            const geometry = new THREE.SphereBufferGeometry(10 * 1024, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
            const material = new THREE.MeshBasicMaterial({
              color: 0x808080,
              wireframe: true,
              transparent: true,
            });

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(domeMesh); */

          const skyboxMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(200000, 200000, 200000)
            geometry.applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));

            const skyboxImgs = [
              'right',
              'left',
              'top',
              'bottom',
              'front',
              'back',
            ].map(face => cubeMapImgs[face]);
            const materials = skyboxImgs.map(skyboxImg => {
              const texture = new THREE.Texture(
                skyboxImg,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping,
                THREE.ClampToEdgeWrapping,
                THREE.NearestFilter,
                THREE.NearestFilter,
                THREE.RGBAFormat,
                THREE.UnsignedByteType,
                1
              );
              texture.needsUpdate = true;

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                color: 0xFFFFFF,
                side: THREE.BackSide,
              });
              return  material;
            });
            const material = new THREE.MultiMaterial(materials);

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(skyboxMesh);

          /* const starsMesh = (() => {
            const numStars = 128;

            const geometry = (() => {
              const result = new THREE.BufferGeometry();
              const vertices = new Float32Array(numStars * 3);

              const upVector = new THREE.Vector3(0, 1, 0);

              for (let i = 0; i < numStars; i++) {
                const radius = 10000 + (Math.random() * (20000 - 10000));
                const magnitudeVector = new THREE.Vector3(0, radius, 0);
                const directionVector = new THREE.Vector3(-0.5 + Math.random(), -0.5 + Math.random(), -0.5 + Math.random()).normalize();
                const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, directionVector);

                const position = magnitudeVector.clone().applyQuaternion(quaternion);

                vertices[(i * 3) + 0] = position.x;
                vertices[(i * 3) + 1] = position.y;
                vertices[(i * 3) + 2] = position.z;
              }
              result.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
              return result;
            })();
            const material = new THREE.PointsMaterial({
              color: 0xCCCCCC,
              size: 50,
              fog: false,
              // opacity: 1,
              // transparent: true,
            });
            const mesh = new THREE.Points(geometry, material);
            // mesh.frustumCulled = false;
            // mesh.renderOrder = 1;
            return mesh;
          })();
          object.add(starsMesh); */

          return object;
        })();

        const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.2);

        const directionalLight = (() => {
          const light = new THREE.DirectionalLight(0xFFFFFF, 2);
          light.position.set(4, 3, 2);
          light.lookAt(new THREE.Vector3(0, 0, 0));
          light.shadow.mapSize.width = SHADOW_MAP_SIZE;
          light.shadow.mapSize.height = SHADOW_MAP_SIZE;
          light.castShadow = true;
          return light;
        })();

        let live = false;

        const _enable = () => {
          live = true;

          scene.add(mesh);
          scene.add(ambientLight);
          scene.add(directionalLight);
        };
        const _disable = () => {
          live = false;

          scene.remove(mesh);
          scene.remove(ambientLight);
          scene.remove(directionalLight);
        };

        const _init = () => {
          const c = config.getConfig();
          const {airlock} = c;

          if (airlock) {
            _enable();
          }
        };
        _init();

        const _config = config => {
          const {airlock} = config;

          if (airlock && !live) {
            _enable();
          } else if (!airlock && live) {
            _disable();
          };
        };
        config.on('config', _config);

        this._cleanup = () => {
          scene.remove(mesh);
          scene.remove(ambientLight);

          config.removeListener('config', _config);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Airlock;
