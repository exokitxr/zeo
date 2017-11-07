const {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  NAVBAR_WIDTH,
  NAVBAR_HEIGHT,
  NAVBAR_WORLD_WIDTH,
  NAVBAR_WORLD_HEIGHT,
  NAVBAR_WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} = require('./lib/constants/menu');
const names = require('./lib/constants/names.json');
const menuUtils = require('./lib/utils/menu');

const MENU_RANGE = 3;

const SIDES = ['left', 'right'];

class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        site: {
          url: siteUrl,
        },
        server: {
          enabled: serverEnabled,
        },
      },
    } = archae;

    const cleanups = [];
    this._cleanup = () => {
      const oldCleanups = cleanups.slice();
      for (let i = 0; i < oldCleanups.length; i++) {
        const cleanup = oldCleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestPlugins([
      '/core/engines/bootstrap',
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/resource',
      '/core/utils/js-utils',
      '/core/utils/geometry-utils',
      '/core/utils/hash-utils',
      '/core/utils/creature-utils',
    ]).then(([
      bootstrap,
      input,
      three,
      webvr,
      biolumi,
      resource,
      jsUtils,
      geometryUtils,
      hashUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {murmur} = hashUtils;
        const {sfx} = resource;

        const uiTracker = biolumi.makeUiTracker();
        const {dotMeshes, boxMeshes} = uiTracker;
        for (let i = 0; i < SIDES.length; i++) {
          const side = SIDES[i];
          scene.add(dotMeshes[side]);
          scene.add(boxMeshes[side]);
        }

        const localUpdates = [];

        const statusState = {
          state: 'connecting',
          url: '',
          address: '',
          port: 0,
          username: '',
          users: [],
        };
        const menuState = {
          open: false,
          position: new THREE.Vector3(0, DEFAULT_USER_HEIGHT, -1.5),
          rotation: new THREE.Quaternion(),
          scale: new THREE.Vector3(1, 1, 1),
        };

        const menuMesh = new THREE.Object3D();
        scene.add(menuMesh);

        const trigger = e => {
          const {side} = e;

          if (menuState.open) {
            sfx.digi_plink.trigger();

            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', trigger, {
          priority: -1,
        });

        const _closeMenu = () => {
          menuMesh.visible = false;

          menuState.open = false; // XXX need to cancel other menu states as well

          uiTracker.setOpen(false);
          _updateUiTracker();

          sfx.digi_powerdown.trigger();

          rendApi.emit('close');
        };
        const _openMenu = () => {
          const {hmd: hmdStatus} = webvr.getStatus();
          const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;

          const newMenuRotation = (() => {
            const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
            hmdEuler.x = 0;
            hmdEuler.z = 0;
            return new THREE.Quaternion().setFromEuler(hmdEuler);
          })();
          const newMenuPosition = hmdPosition.clone()
            .add(new THREE.Vector3(0, 0, -1.5).applyQuaternion(newMenuRotation));
          const newMenuScale = new THREE.Vector3(1, 1, 1);
          menuMesh.position.copy(newMenuPosition);
          menuMesh.quaternion.copy(newMenuRotation);
          menuMesh.scale.copy(newMenuScale);
          menuMesh.visible = true;
          menuMesh.updateMatrixWorld();

          menuState.open = true;
          menuState.position.copy(newMenuPosition);
          menuState.rotation.copy(newMenuRotation);
          menuState.scale.copy(newMenuScale);

          uiTracker.setOpen(true);
          _updateUiTracker();

          sfx.digi_slide.trigger();

          rendApi.emit('open', {
            position: newMenuPosition,
            rotation: newMenuRotation,
            scale: newMenuScale,
          });
        };
        const menudown = () => {
          const {open} = menuState;

          if (open) {
            _closeMenu();
          } else {
            _openMenu();
          }
        };
        input.on('menudown', menudown);

        scene.onBeforeRender = () => {
          rendApi.emit('beforeRender');
        };
        scene.onAfterRender = () => {
          rendApi.emit('afterRender');
        };
        scene.onRenderEye = camera => {
          rendApi.emit('updateEye', camera);
        };
        scene.onBeforeRenderEye = () => {
          rendApi.emit('updateEyeStart');
        };
        scene.onAfterRenderEye = () => {
          rendApi.emit('updateEyeEnd');
        };

        cleanups.push(() => {
          scene.remove(menuMesh);

          for (let i = 0; i < SIDES.length; i++) {
            const side = SIDES[i];
            scene.remove(uiTracker.dotMeshes[side]);
            scene.remove(uiTracker.boxMeshes[side]);
          }

          input.removeListener('trigger', trigger);
          input.removeListener('menudown', menudown);

          scene.onRenderEye = null;
          scene.onBeforeRenderEye = null;
          scene.onAfterRenderEye = null;
        });

        localUpdates.push(() => {
          const _updateMenu = () => {
            if (menuState.open) {
              if (menuMesh.position.distanceTo(webvr.getStatus().hmd.worldPosition) > MENU_RANGE) {
                _closeMenu();
              }
            }
          };

          _updateMenu();
        });

        class RendApi extends EventEmitter {
          constructor() {
            super();

            this.setMaxListeners(100);
          }

          isOpen() {
            return menuState.open;
          }

          getMenuState() {
            return menuState;
          }

          getTab() {
            return navbarState.tab;
          }

          setTab(newTab) {
            const _getTabMesh = tab => {
              switch (tab) {
                case 'status': return menuMesh.statusMesh;
                case 'world': return menuMesh.worldMesh;
                case 'entity': return menuMesh.entityMesh;
                case 'file': return menuMesh.fileMesh;
                case 'servers': return menuMesh.serversMesh;
                case 'wallet': return menuMesh.walletMesh;
                case 'options': return menuMesh.configMesh;
                default: return null;
              }
            };

            const {tab: oldTab} = navbarState;
            const oldMesh = _getTabMesh(oldTab);
            const newMesh = _getTabMesh(newTab);

            oldMesh.visible = false;
            newMesh.visible = true;

            navbarState.tab = newTab;

            _updateNavbarPage();

            this.emit('tabchange', newTab);
          }

          getMenuMesh() {
            return menuMesh;
          }

          getStatus(name) {
            return statusState[name];
          }

          setStatus(name, value) {
            statusState[name] = value;
          }

          update() {
            this.emit('update');
          }

          updateStart() {
            this.emit('updateStart');
          }

          updateEnd() {
            this.emit('updateEnd');
          }

          grab(options) {
            this.emit('grab', options);
          }

          release(options) {
            this.emit('release', options);
          }

          setEntity(item) {
            this.emit('entitychange', item);
          }

          addPage(page) {
            uiTracker.addPage(page);
          }

          removePage(page) {
            uiTracker.removePage(page);
          }

          loadEntities(itemSpecs) {
            this.emit('loadEntities', itemSpecs);
          }

          saveAllEntities() {
            this.emit('saveAllEntities');
          }

          clearAllEntities() {
            this.emit('clearAllEntities');
          }

          getHoverState(side) {
            return uiTracker.getHoverState(side);
          }
        }
        const rendApi = new RendApi();
        rendApi.on('update', () => {
          for (let i = 0; i < localUpdates.length; i++) {
            const localUpdate = localUpdates[i];
            localUpdate();
          }
        });

        return rendApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Rend;
