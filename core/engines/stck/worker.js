const FPS = 1000 / 90;
const GRAVITY = -9.8 / 1000;

importScripts('/archae/three/three.js');
const {exports: THREE} = self.module;
self.module = {};

const zeroVector = new THREE.Vector3();
const oneVector = new THREE.Vector3(1, 1, 1);
const upVector = new THREE.Vector3(0, 1, 0);
const zeroQuaternion = new THREE.Quaternion();

const dynamicBoxBodies = [];
const staticBoxBodies = [];
const staticHeightfieldBodies = [];

class BoxBody {
  constructor(id, {position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1], size = [0.1, 0.1, 0.1], velocity = [0, 0, 0]} = {}) {
    this.id = id;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.size = size;
    this.velocity = velocity;
  }

  update() {
    const {id, position, rotation, scale, velocity} = this;

    postMessage({
      id,
      position,
      rotation,
      scale,
      velocity,
    });
  }

  setState(position, rotation, scale, velocity) {
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.velocity = velocity;

    this.update();
  }
}

class HeightfieldBody {
  constructor(id, {position = [0, 0, 0], width = 0, depth = 0, data = new Float32Array(0)} = {}) {
    this.id = id;
    this.position = position;
    this.width = width;
    this.depth = depth;
    this.data = data;
  }
}

let lastUpdateTime = Date.now();
const interval = setInterval(() => {
  const now = Date.now();
  const timeDiff = now - lastUpdateTime;

  for (let i = 0; i < dynamicBoxBodies.length; i++) {
    const body = dynamicBoxBodies[i];
    const {position, velocity} = body;
    const nextVelocity = new THREE.Vector3()
      .fromArray(velocity)
      .add(upVector.clone().multiplyScalar(GRAVITY * timeDiff));
    const nextPosition = new THREE.Vector3()
      .fromArray(position)
      .add(nextVelocity.clone().multiplyScalar(timeDiff / 1000));

    for (let j = 0; j < staticHeightfieldBodies.length; j++) {
      const staticHeightfieldBody = staticHeightfieldBodies[j];
      const min = new THREE.Vector2(staticHeightfieldBody.position[0], staticHeightfieldBody.position[2]);
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
        const elevations = indexes.map(index => staticHeightfieldBody.data[index] + staticHeightfieldBody.position[1]);
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

        if (nextPosition.y < elevation) {
          nextPosition.y = elevation;
          nextVelocity.copy(zeroVector);
        }
      }
    }

    const nextPositionArray = nextPosition.toArray();
    const positionDiff = !_arrayEquals(nextPositionArray, position);

    const nextVelocityArray = nextVelocity.toArray();
    const velocityDiff = !_arrayEquals(nextVelocityArray, velocity);

    if (positionDiff || velocityDiff) {
      body.setState(nextPositionArray, body.rotation, body.scale, nextVelocityArray);
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
      const [id, type, spec] = args;

      switch (type) {
        case 'dynamicBox': {
          const {position, rotation, scale, velocity} = spec;
          const body = new BoxBody(id, {
            position,
            rotation,
            scale,
            velocity,
          });
          dynamicBoxBodies.push(body);

          break;
        }
        case 'staticHeightfield': {
          const {position, width, depth, data} = spec;
          const body = new HeightfieldBody(id, {
            position,
            width,
            depth,
            data,
          });
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
      const [id] = args;

      let index = dynamicBoxBodies.findIndex(body => body.id === id);
      if (index !== -1) {
        dynamicBoxBodies.splice(index, 1);
      }
      index = staticBoxBodies.findIndex(body => body.id === id);
      if (index !== -1) {
        staticBoxBodies.splice(index, 1);
      }
      index = staticHeightfieldBodies.findIndex(body => body.id === id);
      if (index !== -1) {
        staticHeightfieldBodies.splice(index, 1);
      }

      break;
    }
    case 'setState': {
      const {args} = data;
      const [id, spec] = args;

      break;
    }
    default: {
      console.warn('invalid heightfield worker method:', JSON.stringify(method));
      break;
    }
  }
};

const _arrayEquals = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
