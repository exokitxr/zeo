const symbol = Symbol();

export default class Voxel {
  mount() {
    const {three: {THREE, scene}, elements} = zeo;

    const voxelBlockGenerator = (() => {
      const MASK_SIZE = 4096;
      const mask = new Int32Array(MASK_SIZE);
      const invMask = new Int32Array(MASK_SIZE);

      const TRANSPARENT_MASK = 0x8000;
      const NO_FLAGS_MASK = 0x7FFF;

      function voxelBlockGenerator(voxels, dims, {colorMap}) {
        const mesh = voxelBlockGenerator.getMesh(voxels, dims, {colorMap});
        const {vertices: verticesData, faces: facesData} = mesh;

        const positions = voxelBlockGenerator.getPositions(verticesData);
        const normals = voxelBlockGenerator.getNormals(positions);
        const uvs = voxelBlockGenerator.getUvs(facesData, colorMap);
        const colors = voxelBlockGenerator.getColors(facesData, colorMap);
        return {positions, normals, uvs, colors};
      }

      voxelBlockGenerator.getMesh = function(voxels, dims, {colorMap}) {
        var vertices = [], faces = [], tVertices = [], tFaces = []
          , dimsX = dims[0]
          , dimsY = dims[1]
          , dimsXY = dimsX * dimsY;

        //Sweep over 3-axes
        for(var d=0; d<3; ++d) {
          var i, j, k, l, w, W, h, n, c
            , u = (d+1)%3
            , v = (d+2)%3
            , x = [0,0,0]
            , q = [0,0,0]
            , du = [0,0,0]
            , dv = [0,0,0]
            , dimsD = dims[d]
            , dimsU = dims[u]
            , dimsV = dims[v]
            , qdimsX, qdimsXY
            , xd

          q[d] =  1;
          x[d] = -1;

          qdimsX  = dimsX  * q[1]
          qdimsXY = dimsXY * q[2]

          if (MASK_SIZE < dimsU * dimsV) {
            throw new Error('mask buffer not big enough');
          }

          // Compute mask
          while (x[d] < dimsD) {
            xd = x[d]
            n = 0;

            for(x[v] = 0; x[v] < dimsV; ++x[v]) {
              for(x[u] = 0; x[u] < dimsU; ++x[u], ++n) {
                let a, b;
                if (xd >= 0) {
                  const aOffset = x[0]      + dimsX * x[1]          + dimsXY * x[2];
                  a = voxels[aOffset];
                } else {
                  a = 0;
                }
                if (xd < dimsD-1) {
                  const bOffset = x[0]+q[0] + dimsX * x[1] + qdimsX + dimsXY * x[2] + qdimsXY;
                  b = voxels[bOffset];
                } else {
                  b = 0;
                }

                if (a !== b) {
                  const aT = isTransparent(a);
                  const bT = isTransparent(b);

                  aT && (a = a | TRANSPARENT_MASK);
                  bT && (b = b | TRANSPARENT_MASK);

                  // if both are transparent, add to both directions
                  if (aT && bT) {
                    // nothing
                  // if a is solid and b is not there or transparent
                  } else if (a && (!b || bT)) {
                    b = 0;
                  // if b is solid and a is not there or transparent
                  } else if (b && (!a || aT)) {
                    a = 0;
                  // dont draw this face
                  } else {
                    a = 0;
                    b = 0;
                  }
                } else {
                  a = 0;
                  b = 0;
                }

                mask[n] = a;
                invMask[n] = b;
              }
            }

            ++x[d];

            // Generate mesh for mask using lexicographic ordering
            function generateMesh(mask, dimsV, dimsU, vertices, faces, clockwise) {
              clockwise = clockwise === undefined ? true : clockwise;
              var n, j, i, c, w, h, k, du = [0,0,0], dv = [0,0,0];
              n = 0;
              for (j=0; j < dimsV; ++j) {
                for (i=0; i < dimsU; ) {
                  c = mask[n];
                  if (!c) {
                    i++;  n++; continue;
                  }

                  //Compute width
                  w = 1;
                  while (c === mask[n+w] && i+w < dimsU) w++;

                  //Compute height (this is slightly awkward)
                  for (h=1; j+h < dimsV; ++h) {
                    k = 0;
                    while (k < w && c === mask[n+k+h*dimsU]) k++
                    if (k < w) break;
                  }

                  // Add quad
                  // The du/dv arrays are reused/reset
                  // for each iteration.
                  du[d] = 0; dv[d] = 0;
                  x[u]  = i;  x[v] = j;

                  if (clockwise) {
                  // if (c > 0) {
                    dv[v] = h; dv[u] = 0;
                    du[u] = w; du[v] = 0;
                  } else {
                    // c = -c;
                    du[v] = h; du[u] = 0;
                    dv[u] = w; dv[v] = 0;
                  }

                  // ## enable code to ensure that transparent faces are last in the list
                  if (!isTransparentMasked(c)) {
                    const vertex_count = vertices.length;
                    vertices.push([x[0],             x[1],             x[2]            ]);
                    vertices.push([x[0]+du[0],       x[1]+du[1],       x[2]+du[2]      ]);
                    vertices.push([x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2]]);
                    vertices.push([x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2]]);

                    const color = removeFlags(c);
                    faces.push(color);
                  } else {
                    const vertex_count = tVertices.length;
                    tVertices.push([x[0],             x[1],             x[2]            ]);
                    tVertices.push([x[0]+du[0],       x[1]+du[1],       x[2]+du[2]      ]);
                    tVertices.push([x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2]]);
                    tVertices.push([x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2]]);

                    const color = removeFlags(c);
                    tFaces.push(color);
                  }

                  //Zero-out mask
                  W = n + w;
                  for(l=0; l<h; ++l) {
                    for(k=n; k<W; ++k) {
                      mask[k+l*dimsU] = 0;
                    }
                  }

                  //Increment counters and continue
                  i += w; n += w;
                }
              }
            }
            generateMesh(mask, dimsV, dimsU, vertices, faces, true)
            generateMesh(invMask, dimsV, dimsU, vertices, faces, false)
          }
        }

        return {
          vertices: vertices.concat(tVertices),
          faces: faces.concat(tFaces),
        };

        function isTransparent(type) {
          const color = colorMap[type];

          if (color !== undefined) {
            return color[3] < 1;
          } else {
            return false;
          }
        }

        function isTransparentMasked(v) {
          return (v & TRANSPARENT_MASK) !== 0;
        }

        function removeFlags(v) {
          return v & NO_FLAGS_MASK;
        }
      };

      voxelBlockGenerator.getPositions = function(verticesData) {
        const numFaces = verticesData.length / 4;
        const result = new Float32Array(numFaces * 2 * 3 * 3);

        for (let i = 0; i < numFaces; i++) {
          const faceVertices = [
            verticesData[i * 4 + 0],
            verticesData[i * 4 + 1],
            verticesData[i * 4 + 2],
            verticesData[i * 4 + 3]
          ];

          // abd
          result[i * 18 + 0] = faceVertices[0][0];
          result[i * 18 + 1] = faceVertices[0][1];
          result[i * 18 + 2] = faceVertices[0][2];

          result[i * 18 + 3] = faceVertices[1][0];
          result[i * 18 + 4] = faceVertices[1][1];
          result[i * 18 + 5] = faceVertices[1][2];

          result[i * 18 + 6] = faceVertices[3][0];
          result[i * 18 + 7] = faceVertices[3][1];
          result[i * 18 + 8] = faceVertices[3][2];

          // bcd
          result[i * 18 + 9] = faceVertices[1][0];
          result[i * 18 + 10] = faceVertices[1][1];
          result[i * 18 + 11] = faceVertices[1][2];

          result[i * 18 + 12] = faceVertices[2][0];
          result[i * 18 + 13] = faceVertices[2][1];
          result[i * 18 + 14] = faceVertices[2][2];

          result[i * 18 + 15] = faceVertices[3][0];
          result[i * 18 + 16] = faceVertices[3][1];
          result[i * 18 + 17] = faceVertices[3][2];
        }

        return result;
      };

      voxelBlockGenerator.getNormals = function(positions) {
        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        const normals = geometry.getAttribute('normal').array;
        return normals;
      };

      voxelBlockGenerator.getUvs = function(facesData, colorMap) {
        const numFaces = facesData.length;
        const result = new Float32Array(numFaces * 2 * 3 * 2);

        for (let i = 0; i < numFaces; i++) {
          const faceColor = facesData[i];
          const colorValue = colorMap[faceColor];

          const baseIndex = i * 2 * 3 * 2;
          const numPoints = 2 * 3;
          for (let j = 0; j < numPoints; j++) {
            const pointIndex = j * 2;
            result[baseIndex + pointIndex + 0] = colorValue[3];
            result[baseIndex + pointIndex + 1] = 0.5;
          }
        }

        return result;
      };

      voxelBlockGenerator.getColors = function(facesData, colorMap) {
        const numFaces = facesData.length;
        const result = new Float32Array(numFaces * 2 * 3 * 3);

        for (let i = 0; i < numFaces; i++) {
          const faceColor = facesData[i];
          const colorValue = colorMap[faceColor];

          const baseIndex = i * 2 * 3 * 3;
          const numPoints = 2 * 3;
          for (let j = 0; j < numPoints; j++) {
            const pointIndex = j * 3;
            result[baseIndex + pointIndex + 0] = colorValue[0];
            result[baseIndex + pointIndex + 1] = colorValue[1];
            result[baseIndex + pointIndex + 2] = colorValue[2];
          }
        }

        return result;
      };

      return voxelBlockGenerator;
    })();

    const alphaMap = (() => {
      const width = 256;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(width, 1);
      for (let i = 0; i < width; i++) {
        const baseIndex = i * 4;
        const v = Math.round((i / (width - 1)) * 255);
        imageData.data[baseIndex + 0] = v;
        imageData.data[baseIndex + 1] = v;
        imageData.data[baseIndex + 2] = v;
        imageData.data[baseIndex + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);

      const texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;
      return texture;
    })();

    const voxelComponent = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0.5, 1, -0.5,
            0, 0, 0, 1,
            0.03125, 0.03125, 0.03125,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = {};

        const mesh = (() => {
          const chunkSize = 32;
          const dims = [chunkSize, chunkSize, chunkSize];

          const sphereOrigin = new THREE.Vector3(dims[0] / 2, dims[1] / 2, dims[2] / 2);
          const sphereRadius = 4;
          const liquidOrigin = new THREE.Vector3((dims[0] / 2) - 2, dims[0] / 2 + 2, dims[1] / 2, dims[2] / 2);
          const liquidRadius = 5;

          let numColors = 0;
          const colorNameMap = {
            green: ++numColors,
            blue: ++numColors,
          };
          const colorMap = {
            [colorNameMap.green]: [0, 1, 0.6, 1],
            [colorNameMap.blue]: [0, 0.25, 1, 0.5],
          };

          const geometry = (() => {
            const voxels = (() => {
              const result = new Uint8Array(dims[0] * dims[1] * dims[2]);

              for (let z = 0; z < dims[2]; z++) {
                for (let y = 0; y < dims[1]; y++) {
                  for (let x = 0; x < dims[0]; x++) {
                    const point = new THREE.Vector3(x, y, z);

                    const distanceToLiquidOrigin = Math.abs(point.distanceTo(liquidOrigin));
                    if (distanceToLiquidOrigin <= liquidRadius) {
                      const index = getIndex(x, y, z);
                      result[index] = colorNameMap.blue;

                      continue;
                    }

                    const distanceToSphereOrigin = new THREE.Vector3(
                      Math.abs(point.x - sphereOrigin.x),
                      Math.abs(point.y - sphereOrigin.y),
                      Math.abs(point.z - sphereOrigin.z)
                    );
                    if (
                      distanceToSphereOrigin.x <= sphereRadius &&
                      distanceToSphereOrigin.y <= sphereRadius &&
                      distanceToSphereOrigin.z <= sphereRadius
                    ) {
                      const index = getIndex(x, y, z);
                      result[index] = colorNameMap.green;

                      continue;
                    }
                  }
                }
              }

              function snapCoordinate(n, d) {
                return Math.abs((d + n % d) % d);
              }
              function getIndex(x, y, z) {
                x = snapCoordinate(x, dims[0]);
                y = snapCoordinate(y, dims[1]);
                z = snapCoordinate(z, dims[2]);
                return (x) + (y * dims[0]) + (z * dims[0] * dims[1]);
              }

              return result;
            })();

            const blocks = voxelBlockGenerator(voxels, dims, {
              colorMap,
            });
            const {positions, normals, uvs, colors} = blocks;

            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
            geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
            return geometry;
          })();

          const material = new THREE.MeshPhongMaterial({
            // color: 0xFFFFFF,
            shininess: 0,
            shading: THREE.FlatShading,
            vertexColors: THREE.VertexColors,
            alphaMap: alphaMap,
            alphaTest: 0.1,
            transparent: true,
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(-0.5, -0.5, -0.5);
          mesh.scale.set(1 / dims[0], 1 / dims[1], 1 / dims[2]);
          return mesh;
        })();
        scene.add(mesh);
        entityApi.mesh = mesh;

        entityApi._cleanup = () => {
          scene.remove(mesh);
        };

        entityElement[symbol] = entityApi;
      },
      entityRemovedCallback() {
        const {[symbol]: entityApi} = entityElement;

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const {[symbol]: entityApi} = entityElement;

        switch (name) {
          case 'position': {
            const {mesh} = entityApi;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            mesh.scale.set(newValue[7], newValue[8], newValue[9]);
          }
        }
      },
    };
    elements.registerComponent(this, voxelComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, voxelComponent);
    };
  }  

  unmount() {
    this._cleanup();
  }
};
