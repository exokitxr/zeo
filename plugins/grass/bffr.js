class Bffr {
  constructor(size, count) {
    const buffers = Array(count);
    for (let i = 0; i < count; i++) {
      buffers[i] = new ArrayBuffer(size);
    }
    this.buffers = buffers;
  }

  alloc() {
    return this.buffers.pop();
  }

  free(buffer) {
    this.buffers.push(buffer);
  }
}

const bffr = (size, count) => new Bffr(size, count);
module.exports = bffr;
