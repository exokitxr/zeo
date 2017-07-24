import protocolUtils from './lib/utils/protocol-utils';

const BYTES_PER_PIXEL = 4;
const CUBE_VERTICES = 108;
const NUM_POSITIONS_CHUNK = 300 * 1024;

const spriteUtils = archae => ({
  mount() {
    const worker = new Worker('archae/plugins/_core_utils_sprite-utils/build/worker.js');
    const queue = [];
    worker.requestSpriteGeometry = (imageData, size) => new Promise((accept, reject) => {
      const {width, height, data: {buffer: imageDataBuffer}} = imageData;
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK);
      worker.postMessage({
        width,
        height,
        size,
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

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {THREE} = three;

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
        };
        const _requestSpriteGeometry = (imageData, size) => worker.requestSpriteGeometry(imageData, size);

        return {
          makeImageGeometry: _makeImageGeometry,
          makeImageDataGeometry: _makeImageDataGeometry,
          getImageData: _getImageData,
          requestSpriteGeometry: _requestSpriteGeometry,
        };
      }
    });
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = spriteUtils;
