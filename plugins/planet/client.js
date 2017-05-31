const indev = require('indev');

const SIDES = ['left', 'right'];

class Planet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three: {THREE, scene, camera}, pose, input, render, utils: {random: randomUtils, geometry: geometryUtils}} = zeo;
    const {alea} = randomUtils;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    const forwardVector = new THREE.Vector3(0, 0, -1);
    const upVector = new THREE.Vector3(0, 1, 0);
    const oneDistance = Math.sqrt(3);

    const normalMaterial = new THREE.MeshPhongMaterial({
      color: 0xF44336,
      shading: THREE.FlatShading,
      transparent: true,
      opacity: 0.5,
    });
    const planetMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      shading: THREE.FlatShading,
    });

    const _makeDotMesh = () => {
      const geometry = geometryUtils.concatBufferGeometry([
        new THREE.BoxBufferGeometry(0.02, 0.02, 0.02),
        new THREE.TorusBufferGeometry(0.05, 0.01, 3, 6)
         .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2)),
      ])
      const material = normalMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      return mesh;
    };
    const dotMeshes = {
      left: _makeDotMesh(),
      right: _makeDotMesh(),
    };
    scene.add(dotMeshes.left);
    scene.add(dotMeshes.right);

    const rng = new alea('q');
    const generator = indev({
      random: rng,
    });
    const elevationNoise = generator.uniform({
      frequency: 0.04,
      octaves: 8,
    });

    const size = 50;
    const width = size;
    const height = size;
    const depth = size;
    const _sum = v => v.x + v.y + v.z;
    const _makeSideGenerator = ({normal, u, v, uv}) => {
      const heightmap = new Float32Array(size * size);
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const index = i + (j * size);
          heightmap[index] = elevationNoise.in2D((uv.x * size) + i, (uv.y * size) + j) * 20;
        }
      }

      return (x, y, z) => {
        const vector = new THREE.Vector3(x, y, z);
        const length = vector.length();

        if (length > 0) {
          const angle = vector.angleTo(normal);
          const angleFactor = 1 - (angle / Math.PI);
          const uValue = _sum(u.clone().multiply(vector)) + (size / 2);
          const vValue = _sum(v.clone().multiply(vector)) + (size / 2);
          const index = uValue + (vValue * size);
          const heightValue = heightmap[index];
          const insideOutsideValue = (length <= heightValue) ? -1 : 1;
          const etherValue = insideOutsideValue * angleFactor;
          return etherValue;
        } else {
          return -1;
        }
      };
    };

    const sideGenerators = [
      _makeSideGenerator({ // front
        normal: new THREE.Vector3(0, 0, 1),
        u: new THREE.Vector3(1, 0, 0),
        v: new THREE.Vector3(0, 1, 0),
        uv: new THREE.Vector2(0, 0),
      }),
      _makeSideGenerator({ // top
        normal: new THREE.Vector3(0, 1, 0),
        u: new THREE.Vector3(1, 0, 0),
        v: new THREE.Vector3(0, 0, 1),
        uv: new THREE.Vector2(0, -1),
      }),
      _makeSideGenerator({ // bottom
        normal: new THREE.Vector3(0, 1, 0),
        u: new THREE.Vector3(1, 0, 0),
        v: new THREE.Vector3(0, 0, 1),
        uv: new THREE.Vector2(0, 1),
      }),
      _makeSideGenerator({ // left
        normal: new THREE.Vector3(1, 0, 0),
        u: new THREE.Vector3(0, 0, 1),
        v: new THREE.Vector3(0, -1, 0),
        uv: new THREE.Vector2(-1, 0),
      }),
      _makeSideGenerator({ // right
        normal: new THREE.Vector3(1, 0, 0),
        u: new THREE.Vector3(0, 0, 1),
        v: new THREE.Vector3(0, 1, 0),
        uv: new THREE.Vector2(1, 0),
      }),
      _makeSideGenerator({ // back
        normal: new THREE.Vector3(0, 0, 1),
        u: new THREE.Vector3(1, 0, 0),
        v: new THREE.Vector3(0, 1, 0),
        uv: new THREE.Vector2(2, 0),
      }),
    ];

    cleanups.push(() => {
      normalMaterial.dispose();
      planetMaterial.dispose();

      SIDES.forEach(side => {
        scene.remove(dotMeshes[side]);
      });
    });

    const _getCoordIndex = (x, y, z) => x + (y * width) + (z * width * height);
    const _getInitialPlanetData = () => {
      const result = new Uint8Array((3 * 4) + (width * height * depth * 4));

      new Uint32Array(result.buffer, 4 * 0, 4 * 1, 1)[0] = width;
      new Uint32Array(result.buffer, 4 * 1, 4 * 2, 1)[0] = height;
      new Uint32Array(result.buffer, 4 * 2, 4 * 3, 1)[0] = depth;

      const data = new Float32Array(result.buffer, 3 * 4);
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          for (let z = 0; z < depth; z++) {
            const index = _getCoordIndex(x, y, z);
            const dx = x - (width / 2);
            const dy = y - (height / 2);
            const dz = z - (depth / 2);

            let v = 0;
            for (let i = 0; i < sideGenerators.length; i++) {
              v += sideGenerators[i](dx, dy, dz);
            }
            data[index] = v;
          }
        }
      }

      result.mine = (x, y, z) => {
        const ax = x + (width / 2);
        const ay = y + (height / 2);
        const az = z + (depth / 2);
        const data = new Float32Array(result.buffer, 3 * 4);

        for (let i = -1; i <= 1; i++) {
          const cx = ax + i;

          if (cx >= 0 && cx < size) {
            for (let j = -1; j <= 1; j++) {
              const cy = ay + j;

              if (cy >= 0 && cy < size) {
                for (let k = -1; k <= 1; k++) {
                  const cz = az + k;

                  if (cz >= 0 && cz < size) {
                    const distance = Math.sqrt((i * i) + (j * j) + (k * k));
                    const distanceFactor = distance / oneDistance;
                    const valueFactor = 1 - distanceFactor;
                    const index = _getCoordIndex(cx, cy, cz);
                    data[index] += valueFactor;
                  }
                }
              }
            }
          }
        }
      };

      return result;
    };
    const _requestMarchingCubes = planetData => fetch('/archae/planet/marchingcubes', {
      method: 'POST',
      body: planetData,
    })
      .then(res => res.arrayBuffer())
      .then(marchingCubesBuffer => {
        const marchingCubesArray = new Uint8Array(marchingCubesBuffer);
        const numPositions = new Uint32Array(marchingCubesBuffer, 4 * 0, 1)[0];
        const numNormals = new Uint32Array(marchingCubesBuffer, 4 * 1, 1)[0];
        const positions = new Float32Array(marchingCubesBuffer, 2 * 4, numPositions);
        const normals = new Float32Array(marchingCubesBuffer, (2 * 4) + (numPositions * 4), numNormals);
        return {
          positions,
          normals,
        };
      });

    const planetData = _getInitialPlanetData();

    return _requestMarchingCubes(planetData)
      .then(marchingCubes => {
        if (live) {
          const planetMesh = (() => {
            const geometry = new THREE.BufferGeometry();
            const material = planetMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.render = marchingCubes => {
              const {positions, normals} = marchingCubes;
              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
            };
            return mesh;
          })();
          planetMesh.render(marchingCubes);
          scene.add(planetMesh);

          const _trigger = e => {
            const {side} = e;
            const dotMesh = dotMeshes[side];

            if (dotMesh.visible) {
              const {position: targetPosition} = dotMesh;
              const planetPosition = targetPosition.clone().applyMatrix4(new THREE.Matrix4().getInverse(planetMesh.matrixWorld));
              planetData.mine(
                Math.round(planetPosition.x),
                Math.round(planetPosition.y),
                Math.round(planetPosition.z)
              );

              _requestMarchingCubes(planetData)
                .then(marchingCubes => {
                  planetMesh.render(marchingCubes);
                })
                .catch(err => {
                  console.warn(err);
                });

              e.stopImmediatePropagation();
            }
          };
          input.on('trigger', _trigger);
          const _update = () => {
            const {gamepads} = pose.getStatus();

            SIDES.forEach(side => {
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
              const raycaster = new THREE.Raycaster(controllerPosition, forwardVector.clone().applyQuaternion(controllerRotation));
              const intersections = raycaster.intersectObject(planetMesh);
              const dotMesh = dotMeshes[side];

              if (intersections.length > 0) {
                const intersection = intersections[0];
                const {point: intersectionPoint, face: intersectionFace, object: intersectionObject} = intersection;
                const {normal} = intersectionFace;
                const intersectionObjectRotation = intersectionObject.getWorldQuaternion();
                const worldNormal = normal.clone().applyQuaternion(intersectionObjectRotation);

                dotMesh.position.copy(intersectionPoint);
                dotMesh.quaternion.setFromUnitVectors(
                  upVector,
                  worldNormal
                );

                if (!dotMesh.visible) {
                  dotMesh.visible = true;
                }
              } else {
                if (dotMesh.visible) {
                  dotMesh.visible = false;
                }
              }
            });
          };
          render.on('update', _update);

          cleanups.push(() => {
            scene.remove(planetMesh);

            input.removeListener('trigger', _trigger);
            render.removeListener('update', _update);
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Planet;
