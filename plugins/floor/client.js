const geometryutils = require('geometryutils');

const FLOOR_SIZE = 1024;
const GRID_SIZE = 128;
const GRID_RESOLUTION = 4;
const TARGET_RADII = [1, 2, 4, 8, 16, 32, 64, 128, 256];

const FLOOR_COLOR = 0xAAAAAA;
const LINE_COLOR = 0xCCCCCC;
const DOT_COLOR = 0x808080;

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

class Floor {
  mount() {
    const {three: {THREE, scene}, elements} = zeo;

    const geometryUtils = geometryutils({THREE});

    const floorComponent = {
      selector: 'floor[position]',
      attributes: {
        position: {
          type: 'matrix',
          value: DEFAULT_MATRIX,
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

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

          return object;
        })();
        entityObject.add(mesh);

        entityApi._cleanup = () => {
          entityObject.remove(mesh);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityObject = entityElement.getObject();

        switch (name) {
          case 'position': {
            const position = newValue;

            if (position) {
              entityObject.position.set(position[0], position[1], position[2]);
              entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
              entityObject.scale.set(position[7], position[8], position[9]);
            }

            break;
          }
        }
      }
    };
    elements.registerComponent(this, floorComponent);

    this._cleanup = () => {
      elements.registerComponent(this, floorComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Floor;
