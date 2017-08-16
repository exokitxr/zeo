const CHUNK_HEADER_SIZE = 2 * 4;
const CHUNK_BUFFER_SIZE = 0.5 * 1024 * 1024;
const CHUNK_SIZE = CHUNK_HEADER_SIZE + CHUNK_BUFFER_SIZE;

class Chunk {
  constructor(x = 0, z = 0, buffer = new Uint32Array(CHUNK_BUFFER_SIZE / 4)) {
    this.x = x;
    this.z = z;
    this.uint32Buffer = buffer;

    this.dirty = false;
  }

  getBuffer() {
    return this.uint32Buffer;
  }

  generate(generator) {
    generator(this.x, this.z, this.uint32Buffer.buffer, this.uint32Buffer.byteOffset);
    this.dirty = true;
  }
}

class Trra {
  constructor() {
    this.chunks = [];
  }

  load(buffer) {
    const numChunks = buffer.length / CHUNK_SIZE;
    let {byteOffset} = buffer;
    for (let i = 0; i < numChunks; i ++) {
      const chunkHeader = new Int32Array(buffer.buffer, byteOffset, 2);
      const x = chunkHeader[0];
      const z = chunkHeader[1];
      byteOffset += 2 * 4;
      const chunkBuffer = new Uint32Array(buffer.buffer, byteOffset, CHUNK_BUFFER_SIZE/4);
      byteOffset += CHUNK_BUFFER_SIZE;

      const chunk = new Chunk(x, z, chunkBuffer);
      this.chunks.push(chunk);
    }
  }

  save(fn) {
    let byteOffset = 0;

    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];

      if (chunk.dirty) {
        fn(byteOffset, Int32Array.from([chunk.x, chunk.z]));
        byteOffset += CHUNK_HEADER_SIZE;
        fn(byteOffset, chunk.uint32Buffer);
        byteOffset += CHUNK_BUFFER_SIZE;

        chunk.dirty = false;
      } else {
        byteOffset += CHUNK_SIZE;
      }
    }
  }

  getChunk(x, z) {
    return this.chunks.find(chunk => chunk.x === x && chunk.z === z) || null;
  }

  addChunk(x, z, buffer) {
    const chunk = new Chunk(x, z, buffer);
    this.chunks.push(chunk);
    return chunk;
  }

  removeChunk(x, z) {
    this.chunks.splice(this.chunks.findIndex(chunk => chunk.x === x && chunk.z === z), 1);
  }

  makeChunk(x, z) {
    const chunk = new Chunk(x, z);
    this.chunks.push(chunk);
    return chunk;
  }
}

const trra = () => new Trra();
module.exports = trra;
