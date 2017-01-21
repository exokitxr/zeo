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
      '/core/engines/input',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/hands',
      '/core/plugins/creature-utils',
    ])
      .then(([
        three,
        input,
        biolumi,
        rend,
        hands,
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
              const wireframeMaterial = new THREE.MeshBasicMaterial({
                color: 0x0000FF,
                wireframe: true,
                opacity: 0.5,
                transparent: true,
              });
              /* const pointsMaterial = new THREE.PointsMaterial({
                color: 0xFF0000,
                size: 0.01,
              }); */

              const _makeGrabState = () => ({
                grabber: null,
              });
              const grabStates = {
                left: _makeGrabState(),
                right: _makeGrabState(),
              };

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

              const boxMesh = (() => {
                const width = WORLD_WIDTH;
                const height = WORLD_HEIGHT;
                const depth = WORLD_DEPTH;

                const geometry = new THREE.BoxBufferGeometry(width, height, depth);
                const material = wireframeMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 1.2;
                mesh.rotation.order = camera.rotation.order;
                mesh.rotation.y = Math.PI / 2;
                mesh.visible = false;
                return mesh;
              })();
              scene.add(boxMesh);

              const _gripdown = e => {
                const {side} = e;

                if (hands.canGrab(side, menuMesh, {radius: DEFAULT_GRAB_RADIUS})) {
                  const grabber = hands.grab(side, menuMesh);
                  grabber.on('update', ({position, rotation}) => {
                    menuMesh.position.copy(position);
                    menuMesh.quaternion.copy(rotation);
                  });
                  grabber.on('release', ({linearVelocity, angularVelocity}) => {
                    grabState.grabber = null;
                  });

                  const grabState = grabStates[side];
                  grabState.grabber = grabber;
                }
              };
              input.on('gripdown', _gripdown);
              const _gripup = e => {
                const {side} = e;
                hands.release(side);
              };
              input.on('gripup', _gripup);
              const _update = () => {
                const _updateControllers = () => {
                  const grabbable = SIDES.some(side => hands.canGrab(side, menuMesh, {radius: DEFAULT_GRAB_RADIUS}));

                  if (grabbable) {
                    boxMesh.position.copy(menuMesh.position);
                    boxMesh.quaternion.copy(menuMesh.quaternion);

                    if (!boxMesh.visible) {
                      boxMesh.visible = true;
                    }
                  } else {
                    if (boxMesh.visible) {
                      boxMesh.visible = false;
                    }
                  }
                };
                const _updateTextures = () => {
                  const {planeMesh: {menuMaterial}} = menuMesh;
                  const worldTime = world.getWorldTime();

                  biolumi.updateMenuMaterial({
                    ui,
                    menuMaterial,
                    worldTime,
                  });
                };

                _updateControllers();
                _updateTextures();
              };
              rend.on('update', _update);

              this._cleanup = () => {
                scene.remove(menuMesh);
                scene.remove(boxMesh);

                input.removeListener('gripdown', _gripdown);
                input.removeListener('gripup', _gripup);
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
