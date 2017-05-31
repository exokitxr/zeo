const indev = require('indev');

const size = 50;
const width = size;
const height = size;
const depth = size;
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

    const planetMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
    });
    const normalMaterial = new THREE.MeshPhongMaterial({
      color: 0xF44336,
      shading: THREE.FlatShading,
      transparent: true,
      opacity: 0.5,
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
    const moistureNoise = generator.simplex({
      frequency: 0.1,
      octaves: 6,
    });

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
      planetMaterial.dispose();
      normalMaterial.dispose();

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

              const numPositions = positions.length / 3;
              const numTriangles = numPositions / 3;
              const colors = new Float32Array(positions.length);
              for (let i = 0; i < numTriangles; i++) {
                const triangleBaseIndex = i * 3 * 3;

                const pa = new THREE.Vector3(positions[triangleBaseIndex + 0], positions[triangleBaseIndex + 1], positions[triangleBaseIndex + 2]);
                const pb = new THREE.Vector3(positions[triangleBaseIndex + 3], positions[triangleBaseIndex + 4], positions[triangleBaseIndex + 5]);
                const pc = new THREE.Vector3(positions[triangleBaseIndex + 6], positions[triangleBaseIndex + 7], positions[triangleBaseIndex + 9]);
                const center = pa.clone().add(pb).add(pc).divideScalar(3);
                const elevation = center.length();
                const moisture = moistureNoise.in3D(center.x, center.y, center.z);
                const p = new BiomePoint(
                  elevation,
                  moisture,
                  false,
                  false,
                  false,
                  false,
                  0
                );
                const c = _getBiomeColor(p);
                const r = ((c >> (8 * 2)) & 0xFF) / 0xFF;
                const g = ((c >> (8 * 1)) & 0xFF) / 0xFF;
                const b = ((c >> (8 * 0)) & 0xFF) / 0xFF;
                for (let j = 0; j < 3; j++) {
                  const positionBaseIndex = triangleBaseIndex + (j * 3);
                  colors[positionBaseIndex + 0] = r;
                  colors[positionBaseIndex + 1] = g;
                  colors[positionBaseIndex + 2] = b;
                }
              }

              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
              geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
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

const BIOME_COLORS = {
  // Features
  OCEAN: 0x44447a,
  // OCEAN: 0x000000,
  // COAST: 0x33335a,
  COAST: 0x333333,
  LAKESHORE: 0x225588,
  LAKE: 0x336699,
  RIVER: 0x225588,
  MARSH: 0x2f6666,
  // ICE: 0x99ffff,
  ICE: 0x99dddd,
  // BEACH: 0xa09077,
  BEACH: 0xa0b077,
  ROAD1: 0x442211,
  ROAD2: 0x553322,
  ROAD3: 0x664433,
  BRIDGE: 0x686860,
  LAVA: 0xcc3333,

  // Terrain
  SNOW: 0xffffff,
  TUNDRA: 0xbbbbaa,
  BARE: 0x888888,
  SCORCHED: 0x555555,
  TAIGA: 0x99aa77,
  SHRUBLAND: 0x889977,
  TEMPERATE_DESERT: 0xc9d29b,
  TEMPERATE_RAIN_FOREST: 0x448855,
  TEMPERATE_DECIDUOUS_FOREST: 0x679459,
  GRASSLAND: 0x88aa55,
  SUBTROPICAL_DESERT: 0xd2b98b,
  TROPICAL_RAIN_FOREST: 0x337755,
  TROPICAL_SEASONAL_FOREST: 0x559944,
  MAGMA: 0xff3333,
};
class BiomePoint {
  constructor(elevation, moisture, land, water, ocean, coast, lava) {
    this.elevation = elevation;
    this.moisture = moisture;
    this.land = land;
    this.water = water;
    this.ocean = ocean;
    this.coast = coast;
    this.lava = lava;
  }
}
const _getBiome = p => {
  const {
    elevation,
    moisture,
    land,
    water,
    ocean,
    coast,
    lava,
  } = p;

  if (coast) {
    return 'BEACH';
  } else if (ocean) {
    return 'OCEAN';
  } else if (p.water) {
    if (elevation < (size * 0.1)) { return 'MARSH'; }
    if (elevation > (size * 0.25)) { return 'ICE'; }
    return 'LAKE';
  } else if (lava > 2) {
    return 'MAGMA';
  } else if (elevation > (size * 0.3)) {
    if (p.moisture > 0.50) { return 'SNOW'; }
    else if (moisture > 0.33) { return 'TUNDRA'; }
    else if (moisture > 0.16) { return 'BARE'; }
    else { return 'SCORCHED'; }
  } else if (elevation > (size * 0.25)) {
    if (moisture > 0.66) { return 'TAIGA'; }
    else if (moisture > 0.33) { return 'SHRUBLAND'; }
    else { return 'TEMPERATE_DESERT'; }
  } else if (elevation > (size * 0.1)) {
    if (moisture > 0.83) { return 'TEMPERATE_RAIN_FOREST'; }
    else if (moisture > 0.50) { return 'TEMPERATE_DECIDUOUS_FOREST'; }
    else if (moisture > 0.16) { return 'GRASSLAND'; }
    else { return 'TEMPERATE_DESERT'; }
  } else {
    if (moisture > 0.66) { return 'TROPICAL_RAIN_FOREST'; }
    else if (moisture > 0.33) { return 'TROPICAL_SEASONAL_FOREST'; }
    else if (moisture > 0.16) { return 'GRASSLAND'; }
    else { return 'SUBTROPICAL_DESERT'; }
  }
};
const _getBiomeColor = p => BIOME_COLORS[_getBiome(p)];
/* const _getTriangleBiome = (ap, bp, cp) => {
  const elevation = (ap.elevation + bp.elevation + cp.elevation) / 3;
  const moisture = (ap.moisture + bp.moisture + cp.moisture) / 3;
  const numLand = (+ap.land) + (+bp.land) + (+cp.land);
  const land = numLand > 0;
  const numWater = (+ap.water) + (+bp.water) + (+cp.water);
  const water = numWater > 0;
  const numOcean = (+ap.ocean) + (+bp.ocean) + (+cp.ocean);
  const ocean = numOcean > 0;
  const coast = numLand >= 1 && numOcean >= 1;
  const lava = (ap.lava || 0) + (bp.lava || 0) + (cp.lava || 0);

  const p = new BiomePoint(
    elevation,
    moisture,
    land,
    water,
    ocean,
    coast,
    lava
  );
  return _getBiome(p);
} */

module.exports = Planet;
