class Stck {
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
      '/core/utils/js-utils',
    ]).then(([
      jsUtils,
    ]) => {
      if (live) {
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const bodies = {};

        const worker = new Worker('archae/plugins/_core_engines_stck/build/worker.js');
        worker.requestAddBody = (id, type, spec) => {
          worker.postMessage({
            method: 'addBody',
            args: [id, type, spec],
          });
        };
        worker.requestRemoveBody = (id) => {
          worker.postMessage({
            method: 'removeBody',
            args: [id],
          });
        };
        worker.requestSetState = (id, spec) => {
          worker.postMessage({
            method: 'setState',
            args: [id, spec],
          });
        };
        worker.onmessage = e => {
          const {data} = e;
          const {id, position, rotation, scale, velocity} = data;
          const body = bodies[id];
          body.update(position, rotation, scale, velocity);
        };

        class Body extends EventEmitter {
          constructor(id) {
            super();

            this.id = id;
          }

          setState(position, rotation, scale, velocity) {
            const {id} = this;

            worker.requestSetState(id, {
              position,
              rotation,
              scale,
              velocity,
            });
          }

          update(position, rotation, scale, velocity) {
            this.emit('update', {
              position,
              rotation,
              scale,
              velocity,
            });
          }
        }

        const _makeDynamicBoxBody = (position, size) => {
          const id = _makeId();
          const body = new Body(id);
          bodies[id] = body;

          worker.requestAddBody(id, 'dynamicBox', {
            position: position,
            rotation: [0, 0, 0, 1],
            scale: size,
          });

          return body;
        };
        const _makeStaticHeightfieldBody = (position, width, depth, data) => {
          const id = _makeId();
          const body = new Body(id);
          bodies[id] = body;

          worker.requestAddBody(id, 'staticHeightfield', {
            position,
            width,
            depth,
            data,
          });

          return body;
        };
        const _destroyBody = body => {
          const {id} = body;

          worker.requestRemoveBody(id);

          delete bodies[id];
        };

        return {
          makeDynamicBoxBody: _makeDynamicBoxBody,
          makeStaticHeightfieldBody: _makeStaticHeightfieldBody,
          destroyBody: _destroyBody,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);
const _arrayEquals = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const _arrayToBase64 = bytes => {
  var base64    = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var byteLength    = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength    = byteLength - byteRemainder

  var a, b, c, d
  var chunk

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63               // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3)   << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64
};

module.exports = Stck;
