import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/mail';
import mailRender from './lib/render/mail';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];

class Mail {
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
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/plugins/creature-utils',
    ])
      .then(([
        three,
        input,
        webvr,
        biolumi,
        rend,
        creatureUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;

          const transparentMaterial = biolumi.getTransparentMaterial();
          const solidMaterial = biolumi.getSolidMaterial();

          const mailRenderer = mailRender.makeRenderer({creatureUtils});

          const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
          const _decomposeMatrix = matrix => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });

          const _requestUis = () => Promise.all([
            biolumi.requestUi({
              width: WIDTH,
              height: HEIGHT,
            }),
          ])
            .then(([
              menuUi,
            ]) => ({
              menuUi,
            }));

          return _requestUis()
            .then(({
              menuUi
            }) => {
              if (live) {
                const menuHoverStates = {
                  left: biolumi.makeMenuHoverState(),
                  right: biolumi.makeMenuHoverState(),
                };
                const dotMeshes = {
                  left: biolumi.makeMenuDotMesh(),
                  right: biolumi.makeMenuDotMesh(),
                };
                scene.add(dotMeshes.left);
                scene.add(dotMeshes.right);
                const boxMeshes = {
                  left: biolumi.makeMenuBoxMesh(),
                  right: biolumi.makeMenuBoxMesh(),
                };
                scene.add(boxMeshes.left);
                scene.add(boxMeshes.right);

                const mailState = {
                  page: 'threads',
                };
                const focusState = {
                  type: '',
                };

                const menuMesh = (() => {
                  const object = new THREE.Object3D();
                  object.visible = false;

                  const planeMesh = (() => {
                    const mesh = menuUi.addPage(({mail, focus: {type}}) => {
                      return [
                        {
                          type: 'html',
                          src: mailRenderer.getMailPageSrc(mail),
                          x: 0,
                          y: 0,
                          w: WIDTH,
                          h: HEIGHT,
                          scroll: true,
                        },
                      ];
                    }, {
                      type: 'main',
                      state: {
                        mail: mailState,
                        focus: focusState,
                      },
                      worldWidth: WORLD_WIDTH,
                      worldHeight: WORLD_HEIGHT,
                    });
                    mesh.position.z = -1.5;
                    mesh.receiveShadow = true;

                    return mesh;
                  })();
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;

                  const shadowMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
                    const material = transparentMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  object.add(shadowMesh);

                  return object;
                })();
                rend.registerMenuMesh('mailMesh', menuMesh);

                const _updatePages = () => {
                  menuUi.update();
                };
                _updatePages();

                const _trigger = e => {
                  const {side} = e;

                  const menuHoverState = menuHoverStates[side];
                  const {anchor} = menuHoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  let match;
                  if (onclick === 'mail:threads') {
                    mailState.page = 'threads';

                    _updatePages();
                  } else if (onclick === 'mail:users') {
                    mailState.page = 'users';

                    _updatePages();
                  } else if (onclick === 'mail:notifications') {
                    mailState.page = 'notifications';

                    _updatePages();
                  } else if (onclick === 'mail:newThread') {
                    mailState.page = 'newThread';

                    _updatePages();
                  } else if (match = onclick.match(/^mail:thread:([0-9]+)$/)) {
                    // const threadIndex = match[1];

                    mailState.page = 'thread';

                    _updatePages();
                  }
                };
                input.on('trigger', _trigger);
                const _update = () => {
                  const _updateMenuAnchors = () => {
                    const tab = rend.getTab();

                    if (tab === 'mail') {
                      const {gamepads} = webvr.getStatus();
                      const {planeMesh} = menuMesh;
                      const menuMatrixObject = _decomposeObjectMatrixWorld(planeMesh);
                      const {page} = planeMesh;

                      SIDES.forEach(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                          const menuHoverState = menuHoverStates[side];
                          const dotMesh = dotMeshes[side];
                          const boxMesh = boxMeshes[side];

                          biolumi.updateAnchors({
                            objects: [{
                              matrixObject: menuMatrixObject,
                              page: page,
                              width: WIDTH,
                              height: HEIGHT,
                              worldWidth: WORLD_WIDTH,
                              worldHeight: WORLD_HEIGHT,
                              worldDepth: WORLD_DEPTH,
                            }],
                            hoverState: menuHoverState,
                            dotMesh: dotMesh,
                            boxMesh: boxMesh,
                            controllerPosition,
                            controllerRotation,
                          });
                        }
                      });
                    }
                  };
                  _updateMenuAnchors();
                };
                rend.on('update', _update);

                this._cleanup = () => {
                  SIDES.forEach(side => {
                    scene.remove(dotMeshes[side]);
                    scene.remove(boxMeshes[side]);
                  });

                  input.removeListener('trigger', _trigger);
                  rend.removeListener('update', _update);
                };
              }
            });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Mail;
