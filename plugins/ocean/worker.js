importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
self.module = {};

const TEXTURE_WIDTH = 128;
const TEXTURE_HEIGHT = 256;
const NUM_TEXTURE_CHUNKS = TEXTURE_HEIGHT / TEXTURE_WIDTH;

class Box {
  constructor(min, max) {
    this.min = min;
    this.max = max;
  }
}

const _isPointInBox = (p, b) => p.x >= b.min.x && p.x < b.max.x && p.y >= b.min.y && p.y < b.max.y;
const _isPointInBoxes = (p, bs) => {
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (_isPointInBox(p, b)) {
      return true;
    }
  }
  return false;
};
const baseColor = new THREE.Color(0x3F51B5);
const lightColor = baseColor.clone().lerp(new THREE.Color(0xFFFFFF), 0.2);
const darkColor = baseColor.clone().lerp(new THREE.Color(0x000000), 0.2);
const treeTextureAtlas = (() => {
  const data = new Uint8Array(TEXTURE_WIDTH * TEXTURE_HEIGHT * 4);
  for (let y = 0; y < NUM_TEXTURE_CHUNKS; y++) {
    const lightBoxes = Array(50);
    for (let i = 0; i < lightBoxes.length; i++) {
      const min = new THREE.Vector2(Math.random(), Math.random());
      const max = min.clone().add(new THREE.Vector2((0.5 + Math.random() * 0.5) * 0.05/8, (0.5 + Math.random() * 0.5) * 0.05));
      const box = new Box(min, max);
      lightBoxes[i] = box;
    }
    const darkBoxes = Array(30);
    for (let i = 0; i < darkBoxes.length; i++) {
      const min = new THREE.Vector2(Math.random(), Math.random());
      const max = min.clone().add(new THREE.Vector2((0.5 + Math.random() * 0.5) * 0.05/8, (0.5 + Math.random() * 0.5) * 0.05));
      const box = new Box(min, max);
      darkBoxes[i] = box;
    }

    for (let dy = 0; dy < TEXTURE_WIDTH; dy++) {
      for (let dx = 0; dx < TEXTURE_WIDTH; dx++) {
        const ax = dx;
        const ay = (y * TEXTURE_WIDTH) + dy;
        const baseIndex = (ax + (ay * TEXTURE_WIDTH)) * 4;

        const v = new THREE.Vector2(dx / TEXTURE_WIDTH, 1 - (dy / TEXTURE_WIDTH));
        const c =
          _isPointInBoxes(
            v,
            lightBoxes
          ) ?
            lightColor
          : (
            _isPointInBoxes(
              v,
              darkBoxes,
            ) ?
              darkColor
            :
              baseColor
          )//.clone().multiplyScalar(1 + Math.random() * 0.05);

        data.set(
          Uint8Array.from(
            c
              .toArray()
              .concat([1])
              .map(v => Math.floor(v * 255))
          ),
          baseIndex,
          4
        );
      }
    }
  }
  return data;
})();

self.onmessage = e => {
  const {data} = e;

  const {buffer} = data;
  new Uint8Array(buffer).set(treeTextureAtlas);

  postMessage(buffer, [buffer]);
};
