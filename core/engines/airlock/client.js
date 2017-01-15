const GRID_SIZE = 32;
const GRID_RESOLUTION = 4;
const TARGET_RADII = [1, 2, 4, 8, 16, 32, 64, 128, 256];

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
      '/core/plugins/geometry-utils',
    ]).then(([
      three,
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
              // color: 0xFFFFFF,
              // color: 0x333333,
              vertexColors: THREE.VertexColors,
              // opacity: 0.5,
              // transparent: true,
              // depthTest: false,
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
              color: 0xCCCCCC,
              size: 0.02,
            });

            return new THREE.Points(geometry, material);
          })();
          object.add(gridMesh);

          const floorMesh = (() => {
            const geometry = new THREE.PlaneBufferGeometry(GRID_SIZE, GRID_SIZE);
            geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
            geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.1, 0));

            const material = new THREE.MeshPhongMaterial({
              color: 0xFFFFFF,
              // shininess: 30,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            return mesh;
          })();
          object.add(floorMesh);

          const targetMesh = (() => {
            const geometry = (() => {
              const radii = TARGET_RADII;
              const segments = 7;
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
              // geometry.applyMatrix(new THREE.Matrix4().makeRotationY((1 / 20) * (Math.PI * 2)));
              return geometry;
            })();

            const material = new THREE.MeshBasicMaterial({
              color: 0x808080,
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

          return object;
        })();

        const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.15);

        const _enable = () => {
          scene.add(mesh);
          scene.add(ambientLight);
        };
        const _disable = () => {
          scene.remove(mesh);
          scene.remove(ambientLight);
        };

        this._cleanup = () => {
          scene.remove(mesh);
          scene.remove(ambientLight);
        };

        return {
          enable: _enable,
          disable: _disable,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Airlock;
