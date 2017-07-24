importScripts('/archae/assets/three.js');
const {exports: THREE} = self.module;
self.module = {};

const protocolUtils = require('./lib/utils/protocol-utils');

const FPS = 1000 / 90;
const GRAVITY = -9.8 / 1000;

const zeroVector = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);

const buffer = new ArrayBuffer(protocolUtils.BUFFER_SIZE);

const dynamicBoxBodies = [];
const staticBoxBodies = [];
const staticHeightfieldBodies = [];

class BoxBody {
  constructor(n, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1), size = new THREE.Vector3(0.1, 0.1, 0.1), velocity = new THREE.Vector3()) {
    this.n = n;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.size = size;
    this.velocity = velocity;
  }

  setState(position, rotation, scale, velocity) {
    this.position.copy(position);
    this.rotation.copy(rotation);
    this.scale.copy(scale);
    this.velocity.copy(velocity);

    protocolUtils.stringifyUpdate(this.n, this.position, this.rotation, this.scale, this.velocity, buffer, 0);
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

let lastUpdateTime = Date.now();
const nextPosition = new THREE.Vector3();
const nextVelocity = new THREE.Vector3();
const localVector = new THREE.Vector3();
const interval = setInterval(() => {
  const now = Date.now();
  const timeDiff = now - lastUpdateTime;

  for (let i = 0; i < dynamicBoxBodies.length; i++) {
    const body = dynamicBoxBodies[i];
    const {position, velocity, size} = body;
    nextVelocity.copy(velocity)
      .add(localVector.copy(upVector).multiplyScalar(GRAVITY * timeDiff));
    nextPosition.copy(position)
      .add(localVector.copy(nextVelocity).multiplyScalar(timeDiff / 1000));

    for (let j = 0; j < staticHeightfieldBodies.length; j++) {
      const staticHeightfieldBody = staticHeightfieldBodies[j];
      const min = new THREE.Vector2(staticHeightfieldBody.position.x, staticHeightfieldBody.position.z);
      const max = min.clone().add(new THREE.Vector2(staticHeightfieldBody.width, staticHeightfieldBody.depth));
      const nextPosition2D = new THREE.Vector2(nextPosition.x, nextPosition.z);

      if (nextPosition2D.x >= min.x && nextPosition2D.x < max.x && nextPosition2D.y >= min.y && nextPosition2D.y < max.y) { // if heightfield applies
        const ax = Math.floor(nextPosition2D.x);
        const ay = Math.floor(nextPosition2D.y);

        const positions = ((nextPosition2D.x - ax) <= (1 - (nextPosition2D.y - ay))) ? [ // top left triangle
          new THREE.Vector2(ax, ay),
          new THREE.Vector2(ax + 1, ay),
          new THREE.Vector2(ax, ay + 1),
        ] : [ // bottom right triangle
          new THREE.Vector2(ax + 1, ay),
          new THREE.Vector2(ax, ay + 1),
          new THREE.Vector2(ax + 1, ay + 1),
        ];
        const indexes = positions.map(({x, y}) => (x - min.x) + ((y - min.y) * (staticHeightfieldBody.width + 1)));
        const elevations = indexes.map(index => staticHeightfieldBody.data[index] + staticHeightfieldBody.position.y);
        const baryCoord = new THREE.Triangle(
          new THREE.Vector3(positions[0].x, 0, positions[0].y),
          new THREE.Vector3(positions[1].x, 0, positions[1].y),
          new THREE.Vector3(positions[2].x, 0, positions[2].y)
        ).barycoordFromPoint(
          new THREE.Vector3(nextPosition2D.x, 0, nextPosition2D.y)
        );
        const elevation = baryCoord.x * elevations[0] +
          baryCoord.y * elevations[1] +
          baryCoord.z * elevations[2];

        if ((nextPosition.y - (size.y / 2)) < elevation) {
          nextPosition.y = elevation + (size.y / 2);
          nextVelocity.copy(zeroVector);
        }
      }
    }
    if ((nextPosition.y - (size.y / 2)) < 0) {
      nextPosition.y = size.y / 2;
      nextVelocity.copy(zeroVector);
    }

    if (!nextPosition.equals(position) || !nextVelocity.equals(velocity)) {
      body.setState(nextPosition, body.rotation, body.scale, nextVelocity);
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
          dynamicBoxBodies.push(body);

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
          staticHeightfieldBodies.push(body);
          
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

      let index = dynamicBoxBodies.findIndex(body => body.n === n);
      if (index !== -1) {
        dynamicBoxBodies.splice(index, 1);
      }
      index = staticBoxBodies.findIndex(body => body.n === n);
      if (index !== -1) {
        staticBoxBodies.splice(index, 1);
      }
      index = staticHeightfieldBodies.findIndex(body => body.n === n);
      if (index !== -1) {
        staticHeightfieldBodies.splice(index, 1);
      }

      break;
    }
    case 'setState': {
      const {args} = data;
      const [n, spec] = args;

      break;
    }
    default: {
      console.warn('invalid heightfield worker method:', JSON.stringify(method));
      break;
    }
  }
};
