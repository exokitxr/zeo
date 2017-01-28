const GRID_SIZE = 32;
const GRID_RESOLUTION = 4;
const TARGET_RADII = [1, 2, 4, 8, 16, 32, 64, 128, 256];

const LINE_COLOR = 0x808080;

const SHADOW_MAP_SIZE = 2048;

class Airlock {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/rend',
      '/core/plugins/geometry-utils',
    ]).then(([
      three,
      rend,
      geometryUtils,
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

            const positions = new Float32Array(width * depth * resolution * resolution * 3);
            for (let i = 0; i < width; i++) {
              const baseI = i * depth * resolution * resolution * 3;
              for (let j = 0; j < depth; j++) {
                const baseJ = baseI + (j * resolution * resolution * 3);
                for (let k = 0; k < resolution; k++) {
                  const baseK = baseJ + (k * resolution * 3);
                  for (let l = 0; l < resolution; l++) {
                    const baseL = baseK + (l * 3);
                    positions[baseL + 0] = -(width / 2) + i + (k / resolution);
                    positions[baseL + 1] = 0;
                    positions[baseL + 2] = -(depth / 2) + j + (l / resolution);
                  }
                }
              }
            }

            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));

            const material = new THREE.PointsMaterial({
              color: LINE_COLOR,
              size: 0.02,
            });

            return new THREE.Points(geometry, material);
          })();
          object.add(gridMesh);

          const floorMesh = (() => {
            const geometry = new THREE.PlaneBufferGeometry(GRID_SIZE, GRID_SIZE);
            geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
            geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.001, 0));

            const material = new THREE.MeshPhongMaterial({
              color: 0x111111,
              shininess: 1,
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
              // opacity: 0.5,
              // transparent: true,
              // depthTest: flase,
            });
            // material.polygonOffset = true;
            // material.polygonOffsetFactor = -1;
            // material.polygonOffsetUnits = 1;

            const mesh = new THREE.LineSegments(geometry, material);
            return mesh;
          })();
          object.add(targetMesh);

          const skyboxMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(200000, 200000, 200000);
            const material = new THREE.MeshBasicMaterial({
              color: 0x111111,
              side: THREE.BackSide,
            });

            return new THREE.Mesh(geometry, material);
          })();
          object.add(skyboxMesh);

          const starsMesh = (() => {
            const numStars = 500;

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
              color: 0xFFFFFF,
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
          object.add(starsMesh);

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
          const config = rend.getConfig();
          const {airlock} = config;

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
        rend.on('config', _config);

        this._cleanup = () => {
          scene.remove(mesh);
          scene.remove(ambientLight);

          rend.removeListener('config', _config);
        };

        return {};
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Airlock;
