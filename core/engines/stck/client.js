const FPS = 1000 / 90;
const GRAVITY = -9.8;

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
      '/core/engines/three',
      '/core/utils/js-utils',
    ]).then(([
      three,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const downVector = new THREE.Vector3(0, -1, 0);
        const zeroQuaternion = new THREE.Quaternion();

        const dynamicBoxBodies = [];
        const staticBoxBodies = [];
        const staticHeightfieldBodies = [];

        class BoxBody extends EventEmitter {
          constructor(id, {position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [0.1, 0.1, 0.1], velocity = [0, 0, 0]} = {}) {
            super();

            this.id = id;
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.velocity = velocity;
          }

          update() {
            const {position, rotation, scale, vecocity} = this;

            this.emit('update', {
              position,
              rotation,
              scale,
              vecocity,
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
            const {position} = body;
            const nextPosition = new THREE.Vector3()
              .fromArray(position)
              .add(downVector.clone().multiplyScalar(0.01 * timeDiff));

            for (let j = 0; j < staticHeightfieldBodies.length; j++) {
              const staticHeightfieldBody = staticHeightfieldBodies[j];
              const min = new THREE.Vector2(staticHeightfieldBody.position[0], staticHeightfieldBody.position[2]);
              const max = min.clone().add(new THREE.Vector2(staticHeightfieldBody.width, staticHeightfieldBody.depth));
              const nextPosition2D = new THREE.Vector2(nextPosition.x, nextPosition.z);

              if (nextPosition2D.x >= min.x && nextPosition2D.x < max.x && nextPosition2D.y >= min.y && nextPosition2D.y < max.y) { // if heightfield applies
                const ax = Math.floor(nextPosition2D.x);
                const ay = Math.floor(nextPosition2D.y);

                const positions = ((nextPosition2D.x - ax) <= (nextPosition2D.y - ay)) ? [ // top left triangle
                  new THREE.Vector2(ax, ay),
                  new THREE.Vector2(ax + 1, ay),
                  new THREE.Vector2(ax, ay + 1),
                ] : [ // bottom right triangle
                  new THREE.Vector2(ax + 1, ay),
                  new THREE.Vector2(ax, ay + 1),
                  new THREE.Vector2(ax + 1, ay + 1),
                ];
                const indexes = positions.map(({x, y}) => (x - min.x) + ((y - min.y) * staticHeightfieldBody.width));
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

                nextPosition.y = Math.max(nextPosition.y, elevation);

                const nextPositionArray = nextPosition.toArray();
                if (!_arrayEquals(nextPositionArray, position)) {
                  body.setState(nextPositionArray, body.rotation, body.scale, body.velocity);
                }
              }
            }
          }

          lastUpdateTime = now;
        }, FPS);

        this._cleanup = () => {
          clearInterval(interval);
        };

        const _makeDynamicBoxBody = (position, size) => {
          const id = _makeId();
          const body = new BoxBody(id, {
            position,
            rotation: zeroQuaternion.toArray(),
            scale: size,
          });
          dynamicBoxBodies.push(body);
          return body;
        };
        const _makeStaticHeightfieldBody = (position, width, depth, data) => {
          const id = _makeId();
          const body = new HeightfieldBody(id, {
            position,
            width,
            depth,
            data,
          });
          staticHeightfieldBodies.push(body);
          return body;
        };
        const _destroyBody = body => {
          bodies.splice(bodies.indexOf(body), 1);
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

module.exports = Stck;
