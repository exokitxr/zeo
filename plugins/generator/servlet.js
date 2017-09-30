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
          process.stdout.write(new Buffer(Uint32Array.from([id])));
          process.stdout.write(new Buffer(Float32Array.from([4, 5, 6])));

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
