const FLOOR_SIZE = 1024;
const GRID_SIZE = 128;
const GRID_RESOLUTION = 4;
const TARGET_RADII = [1, 2, 4, 8, 16, 32, 64, 128, 256];

const FLOOR_COLOR = 0xAAAAAA;
const LINE_COLOR = 0xCCCCCC;
const DOT_COLOR = 0x666666;

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const meshSymbol = Symbol();
const cleanupSymbol = Symbol();

class Floor {
  mount() {
    const {three: {THREE, scene}, elements, utils: {geometry: geometryUtils}} = zeo;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });

    return _requestImage('/archae/plugins/floor-basic/serve/graphy.png')
      .then(skinImg => {
        if (live) {
          const floorEntity = {
            attributes: {
              position: {
                type: 'matrix',
                value: DEFAULT_MATRIX,
              },
            },
            entityAddedCallback(entityElement) {
              const mesh = (() => {
                const object = new THREE.Object3D();

                /* const axisMesh = (() => {
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
                object.add(axisMesh); */

                /* const gridMesh = (() => {
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
                    size: 0.03,
                  });

                  const mesh = new THREE.Points(geometry, material);
                  return mesh;
                })();
                object.add(gridMesh); */

                /* const floorMesh = (() => {
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
                object.add(floorMesh); */

                /* const targetMesh = (() => {
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
                object.add(targetMesh); */

                const geometry = new THREE.PlaneBufferGeometry(20, 20)
                  .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
                    new THREE.Quaternion().setFromUnitVectors(
                      new THREE.Vector3(0, 0, 1),
                      new THREE.Vector3(0, 1, 0)
                    )
                  ));
                const uvs = geometry.attributes.uv.array;
                const numUvs = uvs.length / 2;
                for (let i = 0; i < numUvs; i++) {
                  uvs[i * 2 + 0] *= 2 * 2;
                  uvs[i * 2 + 1] *= 2;
                }
                const texture = new THREE.Texture(
                  skinImg,
                  THREE.UVMapping,
                  THREE.RepeatWrapping,
                  THREE.RepeatWrapping,
                  THREE.NearestFilter,
                  THREE.NearestFilter,
                  THREE.RGBAFormat,
                  THREE.UnsignedByteType,
                  1
                );
                texture.needsUpdate = true;
                const material = new THREE.MeshBasicMaterial({
                  map: texture,
                  side: THREE.DoubleSide,
                });
                const mesh = new THREE.Mesh(geometry, material);
                object.add(mesh);

                return object;
              })();
              scene.add(mesh);

              entityElement[meshSymbol] = mesh;

              entityElement[cleanupSymbol] = () => {
                scene.remove(mesh);
              };
            },
            entityRemovedCallback(entityElement) {
              entityElement[cleanupSymbol]();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const {[meshSymbol]: mesh} = entityElement;

              switch (name) {
                case 'position': {
                  const position = newValue;

                  if (position) {
                    mesh.position.set(position[0], position[1], position[2]);
                    mesh.quaternion.set(position[3], position[4], position[5], position[6]);
                    mesh.scale.set(position[7], position[8], position[9]);
                  }

                  break;
                }
              }
            }
          };
          elements.registerEntity(this, floorEntity);

          this._cleanup = () => {
            elements.registerEntity(this, floorEntity);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Floor;
