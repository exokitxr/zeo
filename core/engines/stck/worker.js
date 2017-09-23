importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
self.module = {};

const protocolUtils = require('./lib/utils/protocol-utils');

const FPS = 1000 / 90;
const GRAVITY = -9.8 / 1000;

const NUM_CELLS = 16;
const NUM_CELLS_HEIGHT = 128;
const NUM_CHUNKS_HEIGHT = NUM_CELLS_HEIGHT / NUM_CELLS;

let numBodyTypes = 0;
const STATIC_BODY_TYPES = {
  staticHeightfield: numBodyTypes++,
  staticBlockfield: numBodyTypes++,
};

const zeroVector = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);

function mod(value, divisor) {
  var n = value % divisor;
  return n < 0 ? (divisor + n) : n;
}
const _getStaticBodyIndex = (t, x, z) => (mod(t, 0xFFFF) << 16) | (mod(x, 0xFF) << 8) | mod(z, 0xFF);

const buffer = new ArrayBuffer(protocolUtils.BUFFER_SIZE);

const dynamicBodies = {};
const staticBodies = {};

class BoxBody {
  constructor(n, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1), size = new THREE.Vector3(0.1, 0.1, 0.1), velocity = new THREE.Vector3()) {
    this.n = n;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.size = size;
    this.velocity = velocity;
  }

  update(position, rotation, scale, velocity) {
    this.position.copy(position);
    this.rotation.copy(rotation);
    this.scale.copy(scale);
    this.velocity.copy(velocity);

    protocolUtils.stringifyUpdate(this.n, this.position, this.rotation, this.scale, this.velocity, buffer, 0);
    postMessage(buffer);
  }

  collide() {
    protocolUtils.stringifyCollide(this.n, buffer, 0);
    postMessage(buffer);
  }
}

class HeightfieldBody {
  constructor(n, position = new THREE.Vector3(), width = 0, depth = 0, data = new Float32Array(0)) {
    this.n = n;
    this.position = position;
    this.width = width;
    this.depth = depth;
    this.data = data;
  }
}

class BlockfieldBody {
  constructor(n, position = new THREE.Vector3(), width = 0, height = 0, depth = 0, data = new Uint8Array(0)) {
    this.n = n;
    this.position = position;
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.data = data;
  }
}

let lastUpdateTime = Date.now();
const nextPosition = new THREE.Vector3();
const nextVelocity = new THREE.Vector3();
const localVector = new THREE.Vector3();
const localCoord = new THREE.Vector2();
const localTriangle = new THREE.Triangle();
const numPositions = 3;
const positions = (() => {
  const result = Array(numPositions);
  for (let i = 0; i < numPositions; i++) {
    result[i] = new THREE.Vector3();
  }
  return result;
})();
const elevations = Array(numPositions);
const localBaryCoord = new THREE.Vector3();
const interval = setInterval(() => {
  const now = Date.now();
  const timeDiff = now - lastUpdateTime;

  for (const index in dynamicBodies) {
    const body = dynamicBodies[index];
    if (body) {
      const {position, velocity, size} = body;
      nextVelocity.copy(velocity)
        .add(localVector.copy(upVector).multiplyScalar(GRAVITY * timeDiff));
      nextPosition.copy(position)
        .add(localVector.copy(nextVelocity).multiplyScalar(timeDiff / 1000));

      let collided = false;

      const ox = Math.floor(nextPosition.x / NUM_CELLS);
      const oz = Math.floor(nextPosition.z / NUM_CELLS);
      const staticHeightfieldIndex = _getStaticBodyIndex(STATIC_BODY_TYPES.staticHeightfield, ox, oz);
      const staticHeightfieldBody = staticBodies[staticHeightfieldIndex];
      if (staticHeightfieldBody) {
        const nextPosition2D = localCoord.set(nextPosition.x, nextPosition.z);

        const ax = Math.floor(nextPosition2D.x);
        const ay = Math.floor(nextPosition2D.y);

        const _getIndex = ({x, z}) => (x - ox * NUM_CELLS) + ((z - oz * NUM_CELLS) * (staticHeightfieldBody.width + 1));
        const _getElevation = index => staticHeightfieldBody.data[index] + staticHeightfieldBody.position.y;

        if ((nextPosition2D.x - ax) <= (1 - (nextPosition2D.y - ay))) { // top left triangle
          positions[0].set(ax, 0, ay);
          positions[1].set(ax + 1, 0, ay);
          positions[2].set(ax, 0, ay + 1);
        } else { // bottom right triangle
          positions[0].set(ax + 1, 0, ay);
          positions[1].set(ax, 0, ay + 1);
          positions[2].set(ax + 1, 0, ay + 1);
        };
        elevations[0] = _getElevation(_getIndex(positions[0]));
        elevations[1] = _getElevation(_getIndex(positions[1]));
        elevations[2] = _getElevation(_getIndex(positions[2]));
        localTriangle.set(positions[0], positions[1], positions[2])
          .barycoordFromPoint(
            localVector.set(nextPosition2D.x, 0, nextPosition2D.y),
            localBaryCoord
          );
        const elevation = localBaryCoord.x * elevations[0] +
          localBaryCoord.y * elevations[1] +
          localBaryCoord.z * elevations[2];

        if ((nextPosition.y - (size.y / 2)) < elevation) {
          nextPosition.y = elevation + (size.y / 2);
          nextVelocity.copy(zeroVector);

          collided = collided || !velocity.equals(zeroVector);
        }
      }

      const staticBlockfieldIndex = _getStaticBodyIndex(STATIC_BODY_TYPES.staticBlockfield, ox, oz);
      const staticBlockfieldBody = staticBodies[staticBlockfieldIndex];
      if (staticBlockfieldBody) {
        const ax = Math.floor(nextPosition.x);
        const ay = Math.floor(nextPosition.y);
        const az = Math.floor(nextPosition.z);
        const ox = Math.floor(ax / NUM_CELLS);
        const oz = Math.floor(az / NUM_CELLS);
        const lx = ax - ox * NUM_CELLS;
        const ly = ay;
        const lz = az - oz * NUM_CELLS;

        const _getBlockfieldIndex = (x, y, z) => {
          const oy = Math.floor(y / NUM_CELLS);
          return oy * NUM_CELLS * NUM_CELLS * NUM_CELLS +
            (x) +
            ((y - oy * NUM_CELLS) * NUM_CELLS) +
            (z * NUM_CELLS * NUM_CELLS);
        };

        const block = staticBlockfieldBody.data[_getBlockfieldIndex(lx, ly, lz)];
        if (block) {
          nextPosition.copy(position);
          nextVelocity.copy(zeroVector);

          collided = collided || !velocity.equals(zeroVector);
        }
      }

      if ((nextPosition.y - (size.y / 2)) < 0) { // hard limit to y=0
        nextPosition.y = size.y / 2;
        nextVelocity.copy(zeroVector);

        collided = collided || !velocity.equals(zeroVector);
      }

      // emit updates
      if (!nextPosition.equals(position) || !nextVelocity.equals(velocity)) {
        body.update(nextPosition, body.rotation, body.scale, nextVelocity);
      }
      if (collided) {
        body.collide();
      }
    }
  }

  lastUpdateTime = now;
}, FPS);

this._cleanup = () => {
  clearInterval(interval);
};

self.onmessage = e => {
  const {data} = e;
  const {method} = data;

  switch (method) {
    case 'addBody': {
      const {args} = data;
      const [n, type, spec] = args;

      switch (type) {
        case 'dynamicBox': {
          const {position, rotation, scale, size, velocity} = spec;
          const body = new BoxBody(
            n,
            new THREE.Vector3().fromArray(position),
            new THREE.Quaternion().fromArray(rotation),
            new THREE.Vector3().fromArray(scale),
            new THREE.Vector3().fromArray(size),
            new THREE.Vector3().fromArray(velocity)
          );
          dynamicBodies[n] = body;

          break;
        }
        case 'staticHeightfield': {
          const {position, width, depth, data} = spec;
          const body = new HeightfieldBody(
            n,
            new THREE.Vector3().fromArray(position),
            width,
            depth,
            data
          );
          const ox = Math.floor(position[0] / NUM_CELLS);
          const oz = Math.floor(position[2] / NUM_CELLS);
          const index = _getStaticBodyIndex(STATIC_BODY_TYPES.staticHeightfield, ox, oz);
          staticBodies[index] = body;
          
          break;
        }
        case 'staticBlockfield': {
          const {position, width, height, depth, data} = spec;
          const body = new BlockfieldBody(
            n,
            new THREE.Vector3().fromArray(position),
            width,
            height,
            depth,
            data
          );
          const ox = Math.floor(position[0] / NUM_CELLS);
          const oz = Math.floor(position[2] / NUM_CELLS);
          const index = _getStaticBodyIndex(STATIC_BODY_TYPES.staticBlockfield, ox, oz);
          staticBodies[index] = body;

          break;
        }
        default: {
          console.warn('invalid body type:', type);

          break;
        }
      }

      break;
    }
    case 'removeBody': {
      const {args} = data;
      const [n] = args;

      if (dynamicBodies[n]) {
        dynamicBodies[n] = null;
      }
      if (staticBodies[n]) {
        staticBodies[n] = null;
      }

      break;
    }
    /* case 'setState': {
      const {args} = data;
      const [n, spec] = args;

      // XXX

      break;
    } */
    case 'setData': {
      const {args} = data;
      const [n, newData] = args;

      staticBodies[n].data = newData;

      break;
    }
    default: {
      console.warn('invalid heightfield worker method:', JSON.stringify(method));
      break;
    }
  }
};
