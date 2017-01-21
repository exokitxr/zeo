import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/menu';
import tagsRenderer from './lib/render/tags';

const DEFAULT_GRAB_RADIUS = 0.1;

const SIDES = ['left', 'right'];

class Tags {
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
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/plugins/creature-utils',
    ])
      .then(([
        three,
        biolumi,
        rend,
        creatureUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;

          const transparentMaterial = biolumi.getTransparentMaterial();
          const solidMaterial = biolumi.getSolidMaterial();

          const world = rend.getCurrentWorld();

          return Promise.all([
            biolumi.requestUi({
              width: WIDTH,
              height: HEIGHT,
            }),
          ])
            .then(([
              ui,
            ]) => {
              ui.pushPage([
                {
                  type: 'html',
                  src: tagsRenderer.getTagSrc(),
                },
                {
                  type: 'image',
                  img: creatureUtils.makeAnimatedCreature('zeo.sh'),
                  x: 0,
                  y: 0,
                  w: 100,
                  h: 100,
                  frameTime: 300,
                  pixelated: true,
                }
              ], {
                type: 'main',
                immediate: true,
              });

              const menuMesh = (() => {
                const object = new THREE.Object3D();
                object.position.y = 1.2;
                object.rotation.order = camera.rotation.order;
                object.rotation.y = Math.PI / 2;

                const planeMesh = (() => {
                  const width = WORLD_WIDTH;
                  const height = WORLD_HEIGHT;
                  const depth = WORLD_DEPTH;

                  const menuMaterial = biolumi.makeMenuMaterial();

                  const geometry = new THREE.PlaneBufferGeometry(width, height);
                  const materials = [solidMaterial, menuMaterial];

                  const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  // mesh.position.y = 1.5;
                  mesh.receiveShadow = true;
                  mesh.menuMaterial = menuMaterial;

                  const shadowMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(width, height, 0.01);
                    const material = transparentMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  mesh.add(shadowMesh);

                  return mesh;
                })();
                object.add(planeMesh);
                object.planeMesh = planeMesh;

                return object;
              })();
              scene.add(menuMesh);

              const _update = () => {
                const {planeMesh: {menuMaterial}} = menuMesh;
                const worldTime = world.getWorldTime();

                biolumi.updateMenuMaterial({
                  ui,
                  menuMaterial,
                  worldTime,
                });
              };
              rend.on('update', _update);

              this._cleanup = () => {
                rend.removeListener('update', _update);
              };

              return {};
            });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tags;
