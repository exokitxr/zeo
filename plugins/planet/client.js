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
    const {three: {THREE, scene, camera}, pose, input, render, utils: {geometry: geometryUtils}} = zeo;

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

    let holes = new Int32Array(4096);
    let holeIndex = 0;
    const _addHole = (x, y, z) => {
      if ((holeIndex * 3) >= holes.length) {
        const oldHoles = holes;
        holes = new Int32Array(holes.length * 2);
        holes.set(oldHoles);
      }

      const holeIndexBase = holeIndex * 3;
      holes[holeIndexBase + 0] = x + (size / 2);
      holes[holeIndexBase + 1] = y + (size / 2);
      holes[holeIndexBase + 2] = z + (size / 2);
      holeIndex++;
    };

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

    cleanups.push(() => {
      planetMaterial.dispose();
      normalMaterial.dispose();

      SIDES.forEach(side => {
        scene.remove(dotMeshes[side]);
      });
    });

    const _requestMarchingCubes = ({holes = new Int32Array(0)} = {}) => {
      const body = new Int32Array(1 + holes.length);
      body.set(Int32Array.from([holes.length / 3]), 0);
      body.set(holes, 1);

      return fetch('/archae/planet/marchingcubes', {
        method: 'POST',
        body: body.buffer,
      })
        .then(res => res.arrayBuffer())
        .then(marchingCubesBuffer => {
          const marchingCubesArray = new Uint8Array(marchingCubesBuffer);
          const numPositions = new Uint32Array(marchingCubesBuffer, 4 * 0, 1)[0];
          const numNormals = new Uint32Array(marchingCubesBuffer, 4 * 1, 1)[0];
          const numColors = new Uint32Array(marchingCubesBuffer, 4 * 2, 1)[0];
          const positions = new Float32Array(marchingCubesBuffer, 4 * 3, numPositions);
          const normals = new Float32Array(marchingCubesBuffer, (4 * 3) + (numPositions * 4), numNormals);
          const colors = new Float32Array(marchingCubesBuffer, (4 * 3) + (numPositions * 4) + (numNormals * 4), numColors);
          return {
            positions,
            normals,
            colors,
          };
        });
    }

    return _requestMarchingCubes()
      .then(marchingCubes => {
        if (live) {
          const planetMesh = (() => {
            const geometry = new THREE.BufferGeometry();
            const material = planetMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.render = marchingCubes => {
              const {positions, normals, colors} = marchingCubes;

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
              _addHole(
                Math.round(planetPosition.x),
                Math.round(planetPosition.y),
                Math.round(planetPosition.z)
              );

              _requestMarchingCubes({
                holes: new Int32Array(holes.buffer, 0, holeIndex * 3),
              })
                .then(marchingCubes => {
                  console.log('rendered', holeIndex);

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
