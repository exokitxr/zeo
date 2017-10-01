const PullStream = require('pullstream');

const pullstream = new PullStream();
process.stdin.pipe(pullstream);
process.stdin.resume();

const _recurse = () => {
  pullstream.pull(3 * 4, (err, data) => {
    if (!err) {
      const headerBufer = new Uint32Array(data.buffer, data.byteOffset, 3);
      const [method, id, numBuffers] = headerBufer;
      pullstream.pull(numBuffers, (err, data) => {
        if (!err) {
          const headerBuffer = Uint32Array.from([id, 3 * 4]);
          process.stdout.write(new Buffer(headerBuffer.buffer, headerBuffer.byteOffset, headerBuffer.length * headerBuffer.constructor.BYTES_PER_ELEMENT));
          const resultBuffer = Float32Array.from([4, 5, 6]);
          process.stdout.write(new Buffer(resultBuffer.buffer, resultBuffer.byteOffset, resultBuffer.length * resultBuffer.constructor.BYTES_PER_ELEMENT));

          _recurse();
        } else {
          _recurse();
        }
      });
    } else {
      console.warn(err);

      _recurse();
    }
  });
};
_recurse();
