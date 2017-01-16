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

class Mc {
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
      '/core/engines/zeo',
      '/core/plugins/geometry-utils',
      '/core/plugins/sprite-utils',
      '/core/plugins/random-utils',
    ]).then(([
      zeo,
      geometryUtils,
      spriteUtils,
      randomUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;
        const world = zeo.getCurrentWorld();
        const {physics} = world;
        const {alea} = randomUtils;

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
            img.src = url;
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
              accept(img);
            };
            img.onerror = err => {
              reject(img);
            };
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
              scene.add(floorMesh);

              const cubeMesh = (() => {
                const geometry = (() => {
                  const geometry = new THREE.BoxBufferGeometry(1, 1, 1);

                  geometryUtils.unindexBufferGeometry(geometry);

                  const grassTopUvs = uvs['grass-top'];
                  const [grassTopUvTop, grassTopUvRight, grassTopUvBottom, grassTopUvLeft] = grassTopUvs;
                  const grassSideUvs = uvs['grass-side'];
                  const [grassSideUvTop, grassSideUvRight, grassSideUvBottom, grassSideUvLeft] = grassSideUvs;
                  const dirtUvs = uvs['dirt'];
                  const [dirtUvTop, dirtUvRight, dirtUvBottom, dirtUvLeft] = dirtUvs;

                  const geometryUvsAttribute = geometry.getAttribute('uv');
                  const geometryUvs = geometryUvsAttribute.array;

                  const copyUvs = (uvs, i, topUv, bottomUv) => {
                    const baseIndex = i * 6 * 2;

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

                  // right left top bottom front back
                  copyUvs(geometryUvs, 0, grassSideUvTop, grassSideUvBottom);
                  copyUvs(geometryUvs, 1, grassSideUvTop, grassSideUvBottom);
                  copyUvs(geometryUvs, 2, grassTopUvTop, grassTopUvBottom);
                  copyUvs(geometryUvs, 3, dirtUvTop, dirtUvBottom);
                  copyUvs(geometryUvs, 4, grassSideUvTop, grassSideUvBottom);
                  copyUvs(geometryUvs, 5, grassSideUvTop, grassSideUvBottom);
                  return geometry;
                })();
                const material = blockMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(1, 0.5 + 0.01, 1);
                mesh.castShadow = true;
                return mesh;
              })();
              scene.add(cubeMesh);

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
                scene.add(itemMesh);
              });

              const floorPhysicsBody = new physics.Plane({
                position: [0, 0.01, 0],
                dimensions: [0, 1, 0],
                mass: 0,
              });
              physics.add(floorPhysicsBody);

              const itemPhysicsBodies = itemMeshes.map(itemMesh => {
                const physicsBody = new physics.Box({
                  dimensions: [ITEM_SIZE * ITEM_PIXEL_SIZE, ITEM_SIZE * ITEM_PIXEL_SIZE, ITEM_PIXEL_SIZE],
                  position: itemMesh.position.toArray(),
                  rotation: itemMesh.quaternion.toArray(),
                  mass: 1,
                });
                physicsBody.setLinearFactor([0, 0, 0]);
                physicsBody.setAngularFactor([0, 0, 0]);
                physicsBody.setObject(itemMesh);
                return physicsBody;
              });
              itemPhysicsBodies.forEach(physicsBody => {
                physics.add(physicsBody);
              });

              this._cleanup = () => {
                scene.remove(floorMesh);
                scene.remove(cubeMesh);

                itemMeshes.forEach(itmeMesh => {
                  scene.remove(itemMesh);
                });
                itemPhysicsBodies.forEach(physicsBody => {
                  physics.remove(physicsBody);
                });
              };

              return {};
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Mc;
