import indev from 'indev'; // XXX source these from utils
import Kruskal from 'kruskal';

const SIDES = ['left', 'right'];

class Universe {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/hub',
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/plugins/geometry-utils',
      '/core/plugins/random-utils',
      '/core/plugins/creature-utils',
      '/core/plugins/sprite-utils',
    ]).then(([
      hub,
      input,
      three,
      webvr,
      biolumi,
      rend,
      geometryUtils,
      randomUtils,
      creatureUtils,
      spriteUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {alea} = randomUtils;

        const _decomposeObjectMatrixWorld = object => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          object.matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const worldMaterial = new THREE.MeshPhongMaterial({
          color: 0xFFFFFF,
          shininess: 10,
          vertexColors: THREE.FaceColors,
        });
        const linesMaterial = new THREE.LineBasicMaterial({
          color: 0xFFFFFF,
        });
        const wireframeMaterial = new THREE.MeshBasicMaterial({
          color: 0x808080,
          wireframe: true,
        });
        const wireframeHighlightMaterial = new THREE.MeshBasicMaterial({
          color: 0x0000FF,
          wireframe: true,
          opacity: 0.5,
          transparent: true,
        });
        const cursorMaterial = new THREE.MeshPhongMaterial({
          color: 0xFF0000,
          shininess: 10,
          shading: THREE.FlatShading,
        });

        const _makeUniverseState = () => {
          const generator = indev({
            seed: '',
          });
          const noise = generator.simplex({
            frequency: 0.05,
            octaves: 4,
          });

          const _makeWorlds = () => {
            class Point extends THREE.Vector3 {
              constructor(x, y, z, value) {
                super(x, y, z);

                this.value = value;
              }
            }

            class World {
              constructor(worldName, point, rotation) {
                this.worldName = worldName;
                this.point = point;
                this.rotation = rotation;
              }
            }

            const worlds = (() => {
              const numPoints = 10;
              const size = 0.5;
              const resolution = 16;
              const heightScale = 0.2;
              const heightOffset = (0.005 * 12) / 2;

              const rng = new alea('');

              const result = Array(numPoints);
              for (let i = 0; i < numPoints; i++) {
                const x = rng();
                const y = rng();
                const height = noise.in2D(x * resolution, y * resolution);
                const value = rng();

                const point = new Point(
                  (-0.5 + x) * size,
                  (height * heightScale) + heightOffset,
                  (-0.5 + y) * size,
                  value
                );
                const rotation = value * (Math.PI * 2);
                const world = new World('world' + _pad(i, 2), point, rotation);
                result[i] = world;
              }
              return result;
            })();
            return worlds;
          };

          return {
            worlds: _makeWorlds(),
            noise,
          };
        };
        const universeState = _makeUniverseState();

        const mesh = (() => {
          const object = new THREE.Object3D();
          object.position.set(0, -0.25, -0.5);
          // object.scale.set(0.5, 0.5, 0.5);
          object.visible = false;

          const innerMesh = (() => {
            const size = 0.5;
            const resolution = 16;
            const heightScale = 0.2;

            const object = new THREE.Object3D();
            object.size = size;
            object.resolution = resolution;
            object.heightScale = heightScale;

            const {worlds} = universeState;
            const worldsMesh = (() => {
              const result = new THREE.Object3D();

              const _requestWorldMesh = world => new Promise((accept, reject) => {
                const {worldName, point, rotation} = world;

                const img = new Image();
                img.src = creatureUtils.makeStaticCreature('world:' + worldName);
                img.onload = () => {
                  const geometry = spriteUtils.makeImageGeometry(img, 0.005);
                  geometry.applyMatrix(new THREE.Matrix4().makeRotationY(rotation));
                  const material = worldMaterial;

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.copy(point);

                  accept(mesh);
                };
                img.onerror = err => {
                  reject(err);
                };
              });

              for (let i = 0; i < worlds.length; i++) {
                const world = worlds[i];
                _requestWorldMesh(world)
                  .then(worldMesh => {
                    result.add(worldMesh);
                  })
                  .catch(err => {
                    console.warn(err);
                  });
              }

              return result;
            })();
            object.add(worldsMesh);

            const linesMesh = (() => {
              const geometry = new THREE.BufferGeometry();
              const positions = (() => {
                const result = [];

                const edges = (() => {
                  const result = Array(worlds.length * worlds.length);
                  for (let i = 0; i < worlds.length; i++) {
                    for (let j = 0; j < worlds.length; j++) {
                      result[(i * worlds.length) + j] = [i, j];
                    }
                  }
                  return result;
                })();
                const edgeMST = Kruskal.kruskal(worlds, edges, (a, b) => a.point.distanceTo(b.point));
                for (let i = 0; i < edgeMST.length; i++) {
                  const u = worlds[edgeMST[i][0]].point;
                  const v = worlds[edgeMST[i][1]].point;
                  result.push(u.x, u.y, u.z, v.x, v.y, v.z);
                }

                return Float32Array.from(result);
              })();
              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              const material = linesMaterial;

              const mesh = new THREE.LineSegments(geometry, material);
              return mesh;
            })();
            object.add(linesMesh);

            const cursorMesh = (() => {
              const currentWorldName = hub.getWorldName();
              const selectedWorld = worlds.find(world => world.worldName === currentWorldName) || worlds[0];
              const {point} = selectedWorld;

              const geometry = new THREE.TetrahedronBufferGeometry(0.01, 0);
              geometry.applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI * (1/6 + 1/12)));
              geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI * (1/3 - 1/64)));
              geometry.applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));
              const material = cursorMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.position.copy(point.clone().add(new THREE.Vector3(0, 0.005 * (12 + 1), 0)));
              return mesh;
            })();
            object.add(cursorMesh);

            const floorMesh = (() => {
              const geometry = (() => {
                const {noise} = universeState;

                const result = new THREE.PlaneBufferGeometry(size, size, resolution, resolution);
                result.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
                const positionAttribute = result.getAttribute('position');
                const positions = positionAttribute.array;
                const numPositions = positions.length / 3;
                for (let i = 0; i < numPositions; i++) {
                  const baseIndex = i * 3;
                  const x = (positions[baseIndex + 0] + (size / 2)) / size * resolution;
                  const y = (-positions[baseIndex + 2] + (size / 2)) / size * resolution;

                  const height = noise.in2D(x, y) * heightScale;
                  positions[baseIndex + 1] = height;
                }
                // positionAttribute.needsUpdate = true;
                return result;
              })();

              const material = wireframeMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(floorMesh);
            object.floorMesh = floorMesh;

            return object;
          })();
          object.add(innerMesh);
          object.innerMesh = innerMesh;

          const _makeFloorBoxMesh = () => {
            const {size} = innerMesh;

            const geometry = new THREE.BoxBufferGeometry(size, size, size);
            const material = wireframeHighlightMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            return mesh;
          };
          const floorBoxMeshes = {
            left: _makeFloorBoxMesh(),
            right: _makeFloorBoxMesh(),
          };
          object.add(floorBoxMeshes.left);
          object.add(floorBoxMeshes.right);
          object.floorBoxMeshes = floorBoxMeshes;

          return object;
        })();
        rend.addMenuMesh('universeMesh', mesh);

        const universeBoxMeshes = {
          left: biolumi.makeMenuBoxMesh(),
          right: biolumi.makeMenuBoxMesh(),
        };
        scene.add(universeBoxMeshes.left);
        scene.add(universeBoxMeshes.right);

        const trigger = e => {
          const tab = rend.getTab();

          if (tab === 'multiverse') {
            const {side} = e;
            const universeHoverState = universeHoverStates[side];
            const {hoverWorld} = universeHoverState;

            if (hoverWorld) {
              const {world} = hoverWorld;
              const {worldName} = world;

              const {hub: {url: hubUrl}} = metadata;
              if (worldName !== hub.getWorldName()) {
                window.location = window.location.protocol + '//' + worldName + '.' + hubUrl + (window.location.port ? (':' + window.location.port) : ''); // XXX actually load points from the backend here
              }
            }
          }
        };
        input.on('trigger', trigger);
        const triggerdown = e => {
          const tab = rend.getTab();

          if (tab === 'multiverse') {
            const {side} = e;
            const universeHoverState = universeHoverStates[side];
            const {hovered} = universeHoverState;

            if (hovered) {
              const {gamepads} = webvr.getStatus();
              const gamepad = gamepads[side];
              const {position: controllerPosition} = gamepad;
              universeHoverState.dragStartPoint = controllerPosition.clone();

              const {innerMesh} = mesh;
              const {position: innerMeshPosition} = innerMesh;
              universeHoverState.dragStartPosition = innerMeshPosition.clone();
            }
          }
        };
        input.on('triggerdown', triggerdown);

        const triggerup = e => {
          const tab = rend.getTab();

          if (tab === 'multiverse') {
            const {side} = e;
            const universeHoverState = universeHoverStates[side];
            const {dragStartPoint} = universeHoverState;

            if (dragStartPoint) {
              universeHoverState.dragStartPoint = null;
              universeHoverState.dragStartPosition = null;
            }
          }
        };
        input.on('triggerup', triggerup);

        const _makeUniverseHoverState = () => ({
          hovered: null,
          hoverWorld: null,
          dragStartPoint: null,
          dragStartPosition: null,
        });
        const universeHoverStates = {
          left: _makeUniverseHoverState(),
          right: _makeUniverseHoverState(),
        };

        const _update = () => {
          const tab = rend.getTab();

          if (tab === 'multiverse') {
            const _updateAnchors = () => {
              const status = webvr.getStatus();
              const {gamepads} = status;

              SIDES.forEach(side => {
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {position: controllerPosition} = gamepad;

                  const universeHoverState = universeHoverStates[side];
                  const {innerMesh, floorBoxMeshes} = mesh;
                  const {size} = innerMesh;
                  const floorBoxMesh = floorBoxMeshes[side];

                  const {position: universePosition, rotation: universeRotation, scale: universeScale} = _decomposeObjectMatrixWorld(mesh);

                  const boxTarget = geometryUtils.makeBoxTarget(
                    universePosition,
                    universeRotation,
                    universeScale,
                    new THREE.Vector3(size, size, size)
                  );
                  if (boxTarget.containsPoint(controllerPosition)) {
                    universeHoverState.hovered = true;

                    if (!floorBoxMesh.visible) {
                      floorBoxMesh.visible = true;
                    }
                  } else {
                    universeHoverState.hovered = false;

                    if (floorBoxMesh.visible) {
                      floorBoxMesh.visible = false;
                    }
                  }
                }
              });
            };
            const _updateControllers = () => {
              const status = webvr.getStatus();
              const {gamepads} = status;

              const _updateUniverseHover = () => {
                const {worlds} = universeState;

                SIDES.forEach(side => {
                  const gamepad = gamepads[side];
                  const universeHoverState = universeHoverStates[side];
                  const universeBoxMesh = universeBoxMeshes[side];

                  if (gamepad) {
                    const {position: controllerPosition} = gamepad;
                    const {innerMesh} = mesh;

                    const worldDistances = worlds
                      .map(world => {
                        const position = world.point.clone().applyMatrix4(innerMesh.matrixWorld);
                        const distance = controllerPosition.distanceTo(position);

                        return {
                          world,
                          position,
                          distance,
                        };
                      })
                      .filter(({distance}) => distance < 0.1);
                    if (worldDistances.length > 0) {
                      const closestWorld = worldDistances.sort((a, b) => a.distance - b.distance)[0];
                      universeHoverState.hoverWorld = closestWorld;
                    } else {
                      universeHoverState.hoverWorld = null;
                    }
                  } else {
                    universeHoverState.hoverWorld = null;
                  }

                  const {hoverWorld} = universeHoverState;
                  if (hoverWorld !== null) {
                    const {world, position} = hoverWorld;
                    const {rotation} = world;

                    universeBoxMesh.position.copy(position);
                    universeBoxMesh.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0, camera.rotation.order)));
                    universeBoxMesh.scale.set(0.005 * (12 + 2), 0.005 * (12 + 2), 0.005 * (12 + 2));

                    if (!universeBoxMesh.visible) {
                      universeBoxMesh.visible = true;
                    }
                  } else {
                    if (universeBoxMesh.visible) {
                      universeBoxMesh.visible = false;
                    }
                  }
                });
              };
              const _updateUniverseDrag = () => {
                const {innerMesh} = mesh;
                const {position: innerMeshPosition} = _decomposeObjectMatrixWorld(innerMesh);
                const floorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), innerMeshPosition);

                SIDES.some(side => {
                  const gamepad = gamepads[side];
                  const universeHoverState = universeHoverStates[side];
                  const {dragStartPoint} = universeHoverState;

                  if (dragStartPoint) {
                    const {dragStartPoint, dragStartPosition} = universeHoverState;
                    const gamepad = gamepads[side];
                    const {position: controllerPosition} = gamepad;

                    const startPointPlanePoint = floorPlane.projectPoint(dragStartPoint);
                    const currentPointPlanePoint = floorPlane.projectPoint(controllerPosition);

                    const newInnerMeshPosition = dragStartPosition.clone().add(currentPointPlanePoint.clone().sub(startPointPlanePoint));
                    innerMesh.position.copy(newInnerMeshPosition);

                    return true;
                  } else {
                    return false;
                  }
                });
              };

              _updateUniverseHover();
              _updateUniverseDrag();
            };

            _updateAnchors();
            _updateControllers();
          }
        };
        rend.on('update', _update);

        this._cleanup = () => {
          rend.removeMenuMesh('universeMesh');
          SIDES.forEach(side => {
            scene.remove(universeBoxMeshes[side]);
          });

          input.removeListener('trigger', trigger);
          input.removeListener('triggerdown', triggerdown);
          input.removeListener('triggerup', triggerup);
          rend.removeListener('update', _update);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _pad = (n, width) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};

module.exports = Universe;
