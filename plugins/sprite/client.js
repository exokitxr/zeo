const SIZE = 0.01;
const BYTES_PER_PIXEL = 4;
const CUBE_VERTICES = 108;

class Sprite {
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
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        const pixelGeometryVertices = (() => {
          const cubeGeometry = new THREE.CubeGeometry(SIZE, SIZE, SIZE);
          for (let i = 0; i < cubeGeometry.vertices.length; i++) {
            cubeGeometry.vertices[i].x -= SIZE/2;
            cubeGeometry.vertices[i].y -= SIZE/2;
            cubeGeometry.vertices[i].z -= SIZE/2;
          }
          const bufferGeometry = new THREE.BufferGeometry().fromGeometry(cubeGeometry);
          return bufferGeometry.getAttribute('position').array;
        })();
        const pixelMaterial = new THREE.MeshPhongMaterial({
          vertexColors: THREE.FaceColors,
          shininess: 0,
        });

        const getPixelVertices = (x, y, width, height) => {
          const pixelVertices = pixelGeometryVertices.slice();
          for (let i = 0; i < CUBE_VERTICES; i += 3) {
            pixelVertices[i] += (-(width / 2) + x) * SIZE;
          }
          for (let i = 1; i < CUBE_VERTICES; i += 3) {
            pixelVertices[i] -= (-(height / 2) + y) * SIZE;
          }
          return pixelVertices;
        };

        const _requestFileImageData = file =>
          file.fetch({
            type: 'blob',
          })
            .then(blob => new Promise((accept, reject) => {
              const url = URL.createObjectURL(blob);
              const img = new Image();
              img.src = url;
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                accept(imageData);

                URL.revokeObjectURL(url);
              };
              img.onerror = err => {
                console.warn(err);

                URL.revokeObjectURL(url);
              };
            }))
            .catch(err => {
              console.warn(err);
            });

        class SpriteElement extends HTMLElement {
          static get tag() {
            return 'sprite';
          }
          static get attributes() {
            return {
              position: {
                type: 'matrix',
                value: [
                  -0.5, 1, 0,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
              image: {
                type: 'file',
                value: 'https://cdn.rawgit.com/modulesio/zeo-data/24589753c99fd989e5083bbce394afc4aa6b1e91/img/icons/katana.png',
              },
            };
          }

          createdCallback() {
            this.position = null;
            this.mesh = null;

            this._cancelRequest = null;

            this._cleanup = () => {
              const {mesh, _cancelRequest: cancelRequest} = this;
              if (mesh) {
                scene.remove(mesh);
              }
              if (cancelRequest) {
                cancelRequest();
              }
            };
          }

          destructor() {
            this._cleanup();
          }

          attributeValueChangedCallback(name, oldValue, newValue) {
            switch (name) {
              case 'position': {
                this.position = newValue;

                this._updateMesh();

                break;
              }
              case 'image': {
                const file = newValue;

                let live = true;
                this._cancelRequest = () => {
                  live = false;
                };

                _requestFileImageData(file)
                  .then(imageData => {
                    if (live) {
                      const {mesh: oldMesh} = this;
                      if (oldMesh) {
                        scene.remove(oldMesh);
                      }

                      const newMesh = (() => {
                        const geometry = (() => {
                          const {data: pixelData, width, height} = imageData;

                          const getPixel = (x, y) => {
                            const index = (x + y * width) * BYTES_PER_PIXEL;
                            return [
                              pixelData[index + 0],
                              pixelData[index + 1],
                              pixelData[index + 2],
                              pixelData[index + 3],
                            ];
                          };

                          // generate vertices / colors
                          const vertices = [];
                          const colors = [];
                          for (let y = 0; y < height; y++) {
                            for (let x = 0; x < width; x++) {
                              const pixel = getPixel(x, y);
                              const [r, g, b, a] = pixel;
                              const aFactor = a / 255;
                              if (aFactor > 0.5) {
                                const rFactor = r / 255;
                                const gFactor = g / 255;
                                const bFactor = b / 255;

                                const pixelVertices = getPixelVertices(x, y, width, height);
                                for (let i = 0; i < CUBE_VERTICES / 3; i++) {
                                  vertices.push(pixelVertices[i * 3 + 0], pixelVertices[i * 3 + 1], pixelVertices[i * 3 + 2]);
                                  colors.push(rFactor, gFactor, bFactor);
                                }
                              }
                            }
                          }

                          /* // cull adjacent faces
                          const culledVertices = [];
                          const culledColors = [];
                          const seenFacesIndex = {};
                          function getFaceKey(vs) {
                            let x = 0, y = 0, z = 0;
                            for (let i = 0; i < 12; i += 3) x += vs[i];
                            for (let i = 1; i < 12; i += 3) y += vs[i];
                            for (let i = 2; i < 12; i += 3) z += vs[i];
                            return x + y * 256 + z * 256 * 256;
                          }
                          for (let i = 0; i < vertices.length / 12; i++) {
                            const faceVertices = vertices.slice(i * 12, (i + 1) * 12);
                            const faceKey = getFaceKey(faceVertices);
                            if (!(faceKey in seenFacesIndex)) {
                              for (let j = 0; j < 12; j++) {
                                culledVertices.push(vertices[i * 12 + j]);
                                culledColors.push(colors[i * 12 + j]);
                              }
                              seenFacesIndex[faceKey] = true;
                            }
                          } */

                          // construct geometry
                          const geometry = new THREE.BufferGeometry();
                          geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
                          geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
                          geometry.computeVertexNormals();
                          return geometry;
                        })();
                        const material = pixelMaterial;
                        
                        const mesh = new THREE.Mesh(geometry, material);
                        return mesh;
                      })();

                      scene.add(newMesh);
                      this.mesh = newMesh;

                      this._updateMesh();

                      this._cancelRequest = null;
                    }
                  })
                  .catch(err => {
                    console.warn(err);
                  });

                break;
              }
            }
          }

          _updateMesh() {
            const {mesh, position} = this;

            if (mesh && position) {
              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }
          }
        }
        zeo.registerElement(SpriteElement);

        this._cleanup = () => {
          zeo.unregisterElement(SpriteElement);
        };

        return {};
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Sprite;
