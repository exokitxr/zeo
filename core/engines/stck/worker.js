importScripts('/archae/assets/three.js');
const { exports: THREE } = self.module;
self.module = {};

const protocolUtils = require('./lib/utils/protocol-utils');

const FPS = 1000 / 90;
const GRAVITY = -9.8 / 1000;

const NUM_CELLS = 16;
const OVERSCAN = 1;
const NUM_CELLS_OVERSCAN = NUM_CELLS + OVERSCAN;
const NUM_CELLS_HEIGHT = 128;
const NUM_CHUNKS_HEIGHT = NUM_CELLS_HEIGHT / NUM_CELLS;

let numBodyTypes = 0;
const STATIC_BODY_TYPES = {
  staticHeightfield: numBodyTypes++,
  staticEtherfield: numBodyTypes++,
  staticBlockfield: numBodyTypes++,
};

const zeroVector = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);
const forwardVector = new THREE.Vector3(0, 0, -1);

function mod(value, divisor) {
  var n = value % divisor;
  return n < 0 ? divisor + n : n;
}
const _getStaticBodyIndex = (t, x, z) =>
  (mod(t, 0xffff) << 16) | (mod(x, 0xff) << 8) | mod(z, 0xff);
const _getEtherfieldIndex = (x, y, z) =>
  x + z * NUM_CELLS_OVERSCAN + y * NUM_CELLS_OVERSCAN * NUM_CELLS_OVERSCAN;
const _li = (left, right, x) => left * (1 - x) + right * x;
const _bi = (bottomLeft, bottomRight, topLeft, topRight, x, y) =>
  bottomLeft * (1 - x) * (1 - y) +
  bottomRight * x * (1 - y) +
  topLeft * (1 - x) * y +
  topRight * x * y;
const _tri = (c010, c110, c000, c100, c011, c111, c001, c101, x, y, z) =>
  _li(_bi(c010, c110, c000, c100, x, z), _bi(c011, c111, c001, c101, x, z), y);

const buffer = new ArrayBuffer(protocolUtils.BUFFER_SIZE);

const dynamicBodies = {};
const staticBodies = {};

class BoxBody {
  constructor(
    n,
    position = new THREE.Vector3(),
    rotation = new THREE.Quaternion(),
    scale = new THREE.Vector3(1, 1, 1),
    size = new THREE.Vector3(0.1, 0.1, 0.1),
    velocity = new THREE.Vector3()
  ) {
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

    protocolUtils.stringifyUpdate(
      this.n,
      this.position,
      this.rotation,
      this.scale,
      this.velocity,
      buffer,
      0
    );
    postMessage(buffer);
  }

  collide() {
    protocolUtils.stringifyCollide(this.n, buffer, 0);
    postMessage(buffer);
  }
}

/* class HeightfieldBody {
  constructor(n, position = new THREE.Vector3(), width = 0, depth = 0, data = new Float32Array(0)) {
    this.n = n;
    this.position = position;
    this.width = width;
    this.depth = depth;
    this.data = data;
  }
} */

class EtherfieldBody {
  constructor(
    n,
    position = new THREE.Vector3(),
    width = 0,
    height = 0,
    depth = 0,
    data = new Float32Array(0)
  ) {
    this.n = n;
    this.position = position;
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.data = data;
  }
}

class BlockfieldBody {
  constructor(
    n,
    position = new THREE.Vector3(),
    width = 0,
    height = 0,
    depth = 0,
    data = new Uint8Array(0)
  ) {
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
// const localCoord = new THREE.Vector2();
const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
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
const _checkCollision = position => {
  const ox = Math.floor(position.x / NUM_CELLS);
  const oz = Math.floor(position.z / NUM_CELLS);
  /* const staticHeightfieldIndex = _getStaticBodyIndex(STATIC_BODY_TYPES.staticHeightfield, ox, oz);
  const staticHeightfieldBody = staticBodies[staticHeightfieldIndex];
  if (staticHeightfieldBody) {
    const nextPosition2D = localCoord.set(position.x, position.z);

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
  } */

  const staticEtherfieldIndex = _getStaticBodyIndex(
    STATIC_BODY_TYPES.staticEtherfield,
    ox,
    oz
  );
  const staticEtherfieldBody = staticBodies[staticEtherfieldIndex];
  if (staticEtherfieldBody) {
    const ox = Math.floor(position.x / NUM_CELLS);
    const oz = Math.floor(position.z / NUM_CELLS);
    const lx = position.x - ox * NUM_CELLS;
    const ly = position.y;
    const lz = position.z - oz * NUM_CELLS;
    const minX = Math.floor(lx);
    const maxX = Math.ceil(lx);
    const minY = Math.floor(ly);
    const maxY = Math.ceil(ly);
    const minZ = Math.floor(lz);
    const maxZ = Math.ceil(lz);
    const alx = lx - minX;
    const aly = ly - minY;
    const alz = lz - minZ;

    const _getEtherfield = (x, y, z) =>
      staticEtherfieldBody.data[_getEtherfieldIndex(x, y, z)];

    const v = _tri(
      _getEtherfield(minX, minY, minZ),
      _getEtherfield(maxX, minY, minZ),
      _getEtherfield(minX, minY, maxZ),
      _getEtherfield(maxX, minY, maxZ),
      _getEtherfield(minX, maxY, minZ),
      _getEtherfield(maxX, maxY, minZ),
      _getEtherfield(minX, maxY, maxZ),
      _getEtherfield(maxX, maxY, maxZ),
      alx,
      aly,
      alz
    );
    if (v < 0) {
      return true;
    }
  }

  const staticBlockfieldIndex = _getStaticBodyIndex(
    STATIC_BODY_TYPES.staticBlockfield,
    ox,
    oz
  );
  const staticBlockfieldBody = staticBodies[staticBlockfieldIndex];
  if (staticBlockfieldBody) {
    const ax = Math.floor(position.x);
    const ay = Math.floor(position.y);
    const az = Math.floor(position.z);
    const ox = Math.floor(ax / NUM_CELLS);
    const oz = Math.floor(az / NUM_CELLS);
    const lx = ax - ox * NUM_CELLS;
    const ly = ay;
    const lz = az - oz * NUM_CELLS;

    const _getBlockfieldIndex = (x, y, z) => {
      const oy = Math.floor(y / NUM_CELLS);
      return (
        oy * NUM_CELLS * NUM_CELLS * NUM_CELLS +
        x +
        (y - oy * NUM_CELLS) * NUM_CELLS +
        z * NUM_CELLS * NUM_CELLS
      );
    };

    const block = staticBlockfieldBody.data[_getBlockfieldIndex(lx, ly, lz)];
    if (block) {
      return true;
    }
  }

  return false;
};
const interval = setInterval(() => {
  const now = Date.now();
  const timeDiff = now - lastUpdateTime;

  for (const index in dynamicBodies) {
    const body = dynamicBodies[index];
    if (body) {
      const { position, velocity, size } = body;
      nextVelocity
        .copy(velocity)
        .add(localVector.copy(upVector).multiplyScalar(GRAVITY * timeDiff));
      nextPosition
        .copy(position)
        .add(localVector.copy(nextVelocity).multiplyScalar(timeDiff / 1000));

      let collided = false;

      if (_checkCollision(nextPosition)) {
        nextPosition.copy(position);
        nextVelocity.copy(zeroVector);

        collided = collided || !velocity.equals(zeroVector);
      }

      if (nextPosition.y - size.y / 2 < 0) {
        // hard limit to y=0
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

const TELEPORT_GRAVITY = GRAVITY * 1000 / 50000;
const _getTeleportTarget = (position, rotation) => {
  const velocity = localVector2
    .copy(forwardVector) // can't use localVector since it's an argument
    .applyQuaternion(rotation)
    .multiplyScalar(0.05);
  for (let i = 0; i < 1000; i++) {
    position.add(velocity);
    if (_checkCollision(position)) {
      return position;
    }
    velocity.y += TELEPORT_GRAVITY;
  }
  return null;
};
const _getCheckResult = (position, rotation) => {
  const velocity = localVector2
    .copy(forwardVector) // can't use localVector since it's an argument
    .applyQuaternion(rotation)
    .multiplyScalar(0.1);
  for (let i = 0; i < 10; i++) {
    position.add(velocity);
    if (_checkCollision(position)) {
      return true;
    }
  }
  return false;
};

self.onmessage = e => {
  const { data } = e;
  const { method } = data;

  switch (method) {
    case 'addBody': {
      const { args } = data;
      const [n, type, spec] = args;

      switch (type) {
        case 'dynamicBox': {
          const { position, rotation, scale, size, velocity } = spec;
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
        /* case 'staticHeightfield': {
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
        } */
        case 'staticEtherfield': {
          const { position, width, height, depth, data } = spec;
          const body = new EtherfieldBody(
            n,
            new THREE.Vector3().fromArray(position),
            width,
            height,
            depth,
            data
          );
          const ox = Math.floor(position[0] / NUM_CELLS);
          const oz = Math.floor(position[2] / NUM_CELLS);
          const index = _getStaticBodyIndex(
            STATIC_BODY_TYPES.staticEtherfield,
            ox,
            oz
          );
          staticBodies[index] = body;

          break;
        }
        case 'staticBlockfield': {
          const { position, width, height, depth, data } = spec;
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
          const index = _getStaticBodyIndex(
            STATIC_BODY_TYPES.staticBlockfield,
            ox,
            oz
          );
          staticBodies[index] = body;

          break;
        }
        default: {
          console.warn('stck worker got invalid body type:', type);

          break;
        }
      }

      break;
    }
    case 'removeBody': {
      const { args } = data;
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
      const { args } = data;
      const [n, newData] = args;

      staticBodies[n].data = newData;

      break;
    }
    case 'check': {
      const { args } = data;
      const [id, positionArray, rotationArray] = args;

      protocolUtils.stringifyCheck(
        id,
        _getCheckResult(
          localVector.fromArray(positionArray),
          localQuaternion.fromArray(rotationArray)
        ),
        buffer,
        0
      );
      postMessage(buffer);

      break;
    }
    case 'teleport': {
      const { args } = data;
      const [id, positionArray, rotationArray] = args;

      protocolUtils.stringifyTeleport(
        id,
        _getTeleportTarget(
          localVector.fromArray(positionArray),
          localQuaternion.fromArray(rotationArray)
        ),
        buffer,
        0
      );
      postMessage(buffer);

      break;
    }
    default: {
      console.warn(
        'invalid heightfield worker method:',
        JSON.stringify(method)
      );
      break;
    }
  }
};
