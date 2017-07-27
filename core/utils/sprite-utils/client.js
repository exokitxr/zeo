import protocolUtils from './lib/utils/protocol-utils';

const BYTES_PER_PIXEL = 4;
const CUBE_VERTICES = 108;
const NUM_POSITIONS_CHUNK = 150 * 1024;

const spriteUtils = archae => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/utils/js-utils',
    ]).then(([
      three,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE} = three;
        const {bffr} = jsUtils;

        const buffers = bffr(NUM_POSITIONS_CHUNK, 10, {
          dynamic: true,
        });

        const worker = new Worker('archae/plugins/_core_utils_sprite-utils/build/worker.js');
        const queue = [];
        worker.requestSpriteGeometry = (imageData, size, matrix) => new Promise((accept, reject) => {
          const {width, height, data: {buffer: imageDataBuffer}} = imageData;
          const buffer = buffers.alloc();
          worker.postMessage({
            width,
            height,
            size,
            matrix: matrix ? matrix.toArray() : null,
            imageDataBuffer,
            buffer,
          }, [imageDataBuffer, buffer]);
          queue.push(buffer => {
            accept(protocolUtils.parseGeometry(buffer));
          });
        });
        worker.onmessage = e => {
          queue.shift()(e.data);
        };

        const _getImageData = img => {
          if (img.tagName === 'IMG') {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            return ctx.getImageData(0, 0, canvas.width, canvas.height);
          } else if (img.tagName === 'CANVAS') {
            const canvas = img;
            const ctx = canvas.getContext('2d');
            return ctx.getImageData(0, 0, canvas.width, canvas.height);
          } else {
            return null;
          }
        };
        const pixelGeometryVerticesCache = {};
        const _getPixelGeometryVertices = size => {
          const entry = pixelGeometryVerticesCache[size];

          if (entry) {
            return entry.slice();
          } else {
            const newEntry = (() => {
              const cubeGeometry = new THREE.CubeGeometry(size, size, size);
              for (let i = 0; i < cubeGeometry.vertices.length; i++) {
                cubeGeometry.vertices[i].x -= size / 2;
                cubeGeometry.vertices[i].y -= size / 2;
                cubeGeometry.vertices[i].z -= size / 2;
              }
              const bufferGeometry = new THREE.BufferGeometry().fromGeometry(cubeGeometry);
              return bufferGeometry.getAttribute('position').array;
            })();
            pixelGeometryVerticesCache[size] = newEntry;
            return newEntry.slice();
          };
        };
        const _getPixelVertices = (x, y, width, height, size) => {
          const pixelVertices = _getPixelGeometryVertices(size);
          for (let i = 0; i < CUBE_VERTICES; i += 3) {
            pixelVertices[i] += (-(width / 2) + x + 1) * size;
          }
          for (let i = 1; i < CUBE_VERTICES; i += 3) {
            pixelVertices[i] -= (-(height / 2) + y) * size;
          }
          for (let i = 2; i < CUBE_VERTICES; i += 3) {
            pixelVertices[i] += size / 2;
          }
          return pixelVertices;
        };

        const _makeImageGeometry = (img, size = 1) => _makeImageDataGeometry(_getImageData(img), size);
        const _makeImageDataGeometry = (imageData, size = 1) => {
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

                const pixelVertices = _getPixelVertices(x, y, width, height, size);
                for (let i = 0; i < CUBE_VERTICES / 3; i++) {
                  vertices.push(pixelVertices[i * 3 + 0], pixelVertices[i * 3 + 1], pixelVertices[i * 3 + 2]);
                  colors.push(rFactor, gFactor, bFactor);
                }
              }
            }
          }

          // construct geometry
          const geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
          geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
          geometry.computeVertexNormals();
          return geometry;
        };
        const _requestSpriteGeometry = (imageData, size, matrix) => worker.requestSpriteGeometry(imageData, size, matrix);
        const _releaseSpriteGeometry = spriteGeometrySpec => {
          buffers.free(spriteGeometrySpec.buffer);
        };

        return {
          makeImageGeometry: _makeImageGeometry,
          makeImageDataGeometry: _makeImageDataGeometry,
          getImageData: _getImageData,
          requestSpriteGeometry: _requestSpriteGeometry,
          releaseSpriteGeometry: _releaseSpriteGeometry,
        };
      }
    });
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = spriteUtils;
