const atlaspack = require('atlaspack');

const TEXTURES_PATH = 'https://cdn.rawgit.com/modulesio/zeo-data/29412380b29e98b18c746a373bdb73aeff59e27a/img/textures/';
const TEXTURES = {
  'grass-top': 'assets/minecraft/textures/blocks/grass_top2.png',
  'grass-side': 'assets/minecraft/textures/blocks/grass_side.png',
  'dirt': 'assets/minecraft/textures/blocks/dirt.png',
  'fern': 'assets/minecraft/textures/blocks/fern2.png',
  'tallgrass': 'assets/minecraft/textures/blocks/tallgrass2.png',
  'mushroom-brown': 'assets/minecraft/textures/blocks/mushroom_brown.png',
  'mushroom-red': 'assets/minecraft/textures/blocks/mushroom_red.png',
};
const ITEM_TEXTURE_NAMES = [
  'fern',
  'tallgrass',
  'mushroom-brown',
  'mushroom-red',
];

const INITIAL_ATLAS_SIZE = 128;
const ITEM_SIZE = 16;
const ITEM_PIXEL_SIZE = 1 / 32;

const SIDES = ['left', 'right'];

class Mc {
  mount() {
    const {three: {THREE, camera}, elements, input, pose, physics, hands, utils: {geometry: geometryUtils, sprite: spriteUtils, random: {alea}}} = zeo;

    let live = true;
    this.cleanup = () => {
      live = false;
    };

    const physicsWorld = physics.getPhysicsWorld();
    const controllerPhysicsBodies = physics.getControllerPhysicsBodies();

    const _requestTextureAtlas = () => _requestTextureImages()
      .then(textureImages => new Promise((accept, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = INITIAL_ATLAS_SIZE;
        canvas.height = INITIAL_ATLAS_SIZE;

        const atlas = new atlaspack.Atlas(canvas);
        for (const textureName in textureImages) {
          const textureImage = textureImages[textureName];
          textureImage.id = textureName;
          atlas.pack(textureImage);
        }
        const uvs = atlas.uv();

        accept({
          textureImages,
          canvas,
          uvs,
        });
      }));
    const _requestTextureImages = () => new Promise((accept, reject) => {
      const result = {};

      const textureNames = Object.keys(TEXTURES);

      let pends = textureNames.length;
      const pend = () => {
        if (--pends === 0) {
          done();
        }
      };
      const done = () => {
        accept(result);
      };

      const _requestImage = url => new Promise((accept, reject) => {
        const img = new Image();

        img.onload = () => {
          accept(img);
        };
        img.onerror = err => {
          reject(img);
        };

        img.crossOrigin = 'Anonymous';
        img.src = url;
      });

      for (let i = 0; i < textureNames.length; i++) {
        const textureName = textureNames[i];
        const texturePath = TEXTURES[textureName];
        const textureUrl = TEXTURES_PATH + texturePath;

        _requestImage(textureUrl)
          .then(img => {
            result[textureName] = img;

            pend();
          })
          .catch(err => {
            console.warn(err);

            pend();
          });
      }
    });

    return _requestTextureAtlas()
      .then(({textureImages, canvas, uvs}) => {
        if (live) {
          const blockMaterial = (() => {
            const texture = new THREE.Texture(
              canvas,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.NearestFilter,
              THREE.NearestFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              16
            );
            texture.needsUpdate = true;

            const material = new THREE.MeshPhongMaterial({
              map: texture,
              shininess: 10,
            });
            return material;
          })();
          const itemMaterial = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF,
            shininess: 10,
            vertexColors: THREE.FaceColors,
          });

          const mcComponent = {
            selector: 'mc',
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const _makeGrabState = () => ({
                grabber: null,
              });
              const grabStates = {
                left: _makeGrabState(),
                right: _makeGrabState(),
              };

              const floorMesh = (() => {
                const geometry = (() => {
                  const size = 256;
                  const geometry = new THREE.PlaneBufferGeometry(size, size, size, size);
                  geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.01, 0));

                  geometryUtils.unindexBufferGeometry(geometry);

                  const grassUv = uvs['grass-top'];
                  const [topUv, rightUv, bottomUv, leftUv] = grassUv;

                  const geometryUvsAttribute = geometry.getAttribute('uv');
                  const geometryUvs = geometryUvsAttribute.array;
                  const numUvs = geometryUvs.length / 2;
                  const numFaces = numUvs / 6;
                  for (let i = 0; i < numFaces; i++) {
                    const baseIndex = i * 6 * 2;

                    geometryUvs[baseIndex + 0] = topUv[0];
                    geometryUvs[baseIndex + 1] = (1 - topUv[1]);
                    geometryUvs[baseIndex + 2] = topUv[0];
                    geometryUvs[baseIndex + 3] = (1 - bottomUv[1]);
                    geometryUvs[baseIndex + 4] = bottomUv[0];
                    geometryUvs[baseIndex + 5] = (1 - topUv[1]);

                    geometryUvs[baseIndex + 6] = topUv[0];
                    geometryUvs[baseIndex + 7] = (1 - bottomUv[1]);
                    geometryUvs[baseIndex + 8] = bottomUv[0];
                    geometryUvs[baseIndex + 9] = (1 - bottomUv[1]);
                    geometryUvs[baseIndex + 10] = bottomUv[0];
                    geometryUvs[baseIndex + 11] = (1 - topUv[1]);
                  }
                  return geometry;
                })();
                const material = blockMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.receiveShadow = true;
                return mesh;
              })();
              entityObject.add(floorMesh);

              const blockTypeUvs = (() => {
                const grassTopUvs = uvs['grass-top'];
                const [grassTopUvTop, grassTopUvRight, grassTopUvBottom, grassTopUvLeft] = grassTopUvs;
                const grassSideUvs = uvs['grass-side'];
                const [grassSideUvTop, grassSideUvRight, grassSideUvBottom, grassSideUvLeft] = grassSideUvs;
                const dirtUvs = uvs['dirt'];
                const [dirtUvTop, dirtUvRight, dirtUvBottom, dirtUvLeft] = dirtUvs;

                // right left top bottom front back
                return {
                  grass: [
                    [grassSideUvTop, grassSideUvBottom],
                    [grassSideUvTop, grassSideUvBottom],
                    [grassTopUvTop, grassTopUvBottom],
                    [dirtUvTop, dirtUvBottom],
                    [grassSideUvTop, grassSideUvBottom],
                    [grassSideUvTop, grassSideUvBottom],
                  ],
                  dirt: [
                    [dirtUvTop, dirtUvBottom],
                    [dirtUvTop, dirtUvBottom],
                    [dirtUvTop, dirtUvBottom],
                    [dirtUvTop, dirtUvBottom],
                    [dirtUvTop, dirtUvBottom],
                    [dirtUvTop, dirtUvBottom],
                  ],
                };
              })();
              const _makeBlockMesh = spec => {
                const {position, type} = spec;

                const geometry = (() => {
                  const geometry = new THREE.BoxBufferGeometry(1, 1, 1);

                  geometryUtils.unindexBufferGeometry(geometry);

                  const geometryUvsAttribute = geometry.getAttribute('uv');
                  const geometryUvs = geometryUvsAttribute.array;

                  const copyUvs = (uvs, faceIndex, topUv, bottomUv) => {
                    const baseIndex = faceIndex * 6 * 2;

                    uvs[baseIndex + 0] = topUv[0];
                    uvs[baseIndex + 1] = (1 - topUv[1]);
                    uvs[baseIndex + 2] = topUv[0];
                    uvs[baseIndex + 3] = (1 - bottomUv[1]);
                    uvs[baseIndex + 4] = bottomUv[0];
                    uvs[baseIndex + 5] = (1 - topUv[1]);

                    uvs[baseIndex + 6] = topUv[0];
                    uvs[baseIndex + 7] = (1 - bottomUv[1]);
                    uvs[baseIndex + 8] = bottomUv[0];
                    uvs[baseIndex + 9] = (1 - bottomUv[1]);
                    uvs[baseIndex + 10] = bottomUv[0];
                    uvs[baseIndex + 11] = (1 - topUv[1]);
                  };

                  const blockTypeUv = blockTypeUvs[type];
                  for (let faceIndex = 0; faceIndex < blockTypeUv.length; faceIndex++) {
                    const faceUvs = blockTypeUv[faceIndex];
                    copyUvs(geometryUvs, faceIndex, faceUvs[0], faceUvs[1]);
                  }
                  return geometry;
                })();
                const material = blockMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(position);
                mesh.castShadow = true;
                return mesh;
              };
              const blockMeshSpecs = [
                {
                  position: new THREE.Vector3(-1, 0.5 + 0.01, 2),
                  type: 'grass',
                },
                {
                  position: new THREE.Vector3(-2, 0.5 + 0.01, 0),
                  type: 'grass',
                },
                {
                  position: new THREE.Vector3(-2, 0.5 + 0.01, 1),
                  type: 'dirt',
                },
                {
                  position: new THREE.Vector3(-2, 0.5 + 0.01, 2),
                  type: 'grass',
                },
                {
                  position: new THREE.Vector3(-2, 1 + 0.5 + 0.01, 1),
                  type: 'grass',
                },
              ];
              const blockMeshes = blockMeshSpecs.map(_makeBlockMesh);
              blockMeshes.forEach(blockMesh => {
                entityObject.add(blockMesh);
              });

              const itemMeshes = (() => {
                const numItems = 128;
                const width = 32;
                const depth = 32;
                const height = ITEM_SIZE * ITEM_PIXEL_SIZE;

                const rng = new alea();

                const result = Array(numItems);
                for (let i = 0; i < numItems; i++) {
                  const itemMesh = (() => {
                    const textureName = ITEM_TEXTURE_NAMES[Math.floor(rng() * ITEM_TEXTURE_NAMES.length)];
                    const img = textureImages[textureName];
                    const geometry = spriteUtils.makeImageGeometry(img, ITEM_PIXEL_SIZE);
                    const material = itemMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(-(width / 2) + (rng() * width), (height / 2) + 0.01, -(depth / 2) + (rng() * depth));
                    mesh.rotation.order = camera.rotation.order;
                    mesh.rotation.y = (rng() < 0.5) ? 0 : (Math.PI / 2);
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  result[i] = itemMesh;
                }
                return result;
              })();
              itemMeshes.forEach(itemMesh => {
                entityObject.add(itemMesh);
              });

              const floorPhysicsBody = new physicsWorld.Plane({
                position: [0, 0.01, 0],
                dimensions: [0, 1, 0],
                mass: 0,
              });
              physicsWorld.add(floorPhysicsBody);

              const blockPhysicsBodies = blockMeshes.map(blockMesh => {
                const physicsBody = new physicsWorld.Box({
                  dimensions: [1, 1, 1],
                  position: blockMesh.position.toArray(),
                  rotation: blockMesh.quaternion.toArray(),
                  mass: 1,
                });
                physicsBody.setLinearFactor([0, 0, 0]);
                physicsBody.setAngularFactor([0, 0, 0]);
                physicsBody.setLinearVelocity([0, 0, 0]);
                physicsBody.setAngularVelocity([0, 0, 0]);
                physicsBody.setObject(blockMesh);
                return physicsBody;
              });
              blockPhysicsBodies.forEach(physicsBody => {
                physicsWorld.add(physicsBody);
              });

              const itemPhysicsBodies = itemMeshes.map(itemMesh => {
                const physicsBody = new physicsWorld.Box({
                  dimensions: [ITEM_SIZE * ITEM_PIXEL_SIZE, ITEM_SIZE * ITEM_PIXEL_SIZE, ITEM_PIXEL_SIZE],
                  position: itemMesh.position.toArray(),
                  rotation: itemMesh.quaternion.toArray(),
                  mass: 1,
                });
                physicsBody.setLinearFactor([0, 0, 0]);
                physicsBody.setAngularFactor([0, 0, 0]);
                physicsBody.setLinearVelocity([0, 0, 0]);
                physicsBody.setAngularVelocity([0, 0, 0]);
                physicsBody.setObject(itemMesh);
                return physicsBody;
              });
              itemPhysicsBodies.forEach(physicsBody => {
                physicsWorld.add(physicsBody);
              });

              const _getClosestItemMeshIndex = position => itemMeshes.map((itemMesh, index) => {
                const distance = position.distanceTo(itemMesh.position);
                return {
                  index,
                  distance,
                };
              }).sort((a, b) => a.distance - b.distance)[0].index;

              const gripdown = e => {
                const {side} = e;
                const {gamepads} = pose.getStatus();
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {worldPosition: controllerPosition} = gamepad;
                  const itemMeshIndex = _getClosestItemMeshIndex(controllerPosition);
                  const itemMesh = itemMeshes[itemMeshIndex];

                  if (hands.canGrab(side, itemMesh, {radius: ITEM_SIZE * ITEM_PIXEL_SIZE})) {
                    const itemPhysicsBody = itemPhysicsBodies[itemMeshIndex];

                    const controllerPhysicsBody = controllerPhysicsBodies[side];
                    itemPhysicsBody.setIgnoreCollisionCheck(controllerPhysicsBody, true);
                    itemPhysicsBody.setLinearFactor([0, 0, 0]);
                    itemPhysicsBody.setAngularFactor([0, 0, 0]);
                    itemPhysicsBody.setLinearVelocity([0, 0, 0]);
                    itemPhysicsBody.setAngularVelocity([0, 0, 0]);

                    const grabber = hands.grab(side, itemMesh); // XXX needs to be rewritten for the new hands API
                    grabber.on('update', ({position, rotation}) => {
                      itemPhysicsBody.setPosition(position.toArray());
                      itemPhysicsBody.setRotation(rotation.toArray());
                    });
                    grabber.on('release', ({linearVelocity, angularVelocity}) => {
                      itemPhysicsBody.setLinearFactor([1, 1, 1]);
                      itemPhysicsBody.setAngularFactor([1, 1, 1]);
                      itemPhysicsBody.setLinearVelocity(linearVelocity.toArray());
                      itemPhysicsBody.setAngularVelocity(angularVelocity.toArray());
                      itemPhysicsBody.activate();

                      setTimeout(() => { // delay to prevent immediate collision
                        SIDES.forEach(side => {
                          const controllerPhysicsBody = controllerPhysicsBodies[side];
                          itemPhysicsBody.setIgnoreCollisionCheck(controllerPhysicsBody, false);
                        });
                      }, 500);

                      grabState.grabber = null;
                    });

                    const grabState = grabStates[side];
                    grabState.grabber = grabber;
                  }
                }
              };
              input.on('gripdown', gripdown);
              const gripup = e => {
                const {side} = e;
                const grabState = grabStates[side];
                const {grabber} = grabState;

                if (grabber) {
                  grabber.release();
                }
              };
              input.on('gripup', gripup);

              entityApi._cleanup = () => {
                entityObject.remove(floorMesh);

                blockMeshes.forEach(blockMesh => {
                  entityObject.remove(blockMesh);
                });
                blockPhysicsBodies.forEach(physicsBody => {
                  physicsWorld.remove(physicsBody);
                });

                itemMeshes.forEach(itemMesh => {
                  entityObject.remove(itemMesh);
                });
                itemPhysicsBodies.forEach(physicsBody => {
                  physicsWorld.remove(physicsBody);
                });

                input.removeListener('gripdown', gripdown);
                input.removeListener('gripup', gripup);
              };
            },
            entityRemovedCallback() {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
          };
          elements.registerComponent(this, mcComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, mcComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Mc;
