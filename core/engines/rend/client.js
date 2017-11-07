const {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} = require('./lib/constants/menu');

const NUM_POSITIONS = 200 * 1024;

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

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });
    const _requestImageBitmap = src => _requestImage(src)
      .then(img => createImageBitmap(img, 0, 0, img.width, img.height));

    return Promise.all([
      archae.requestPlugins([
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
      ]),
      _requestImageBitmap('/archae/rend/img/browser1.svg'),
      _requestImageBitmap('/archae/rend/img/browser2.svg'),
      _requestImageBitmap('/archae/rend/img/browser3.svg'),
    ]).then(([
      [
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
      ],
      browser1Img,
      browser2Img,
      browser3Img,
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

        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(browser1Img, 0, 0, canvas.width, canvas.height);

        const texture = new THREE.Texture(
          canvas,
          THREE.UVMapping,
          THREE.ClampToEdgeWrapping,
          THREE.ClampToEdgeWrapping,
          THREE.LinearFilter,
          THREE.LinearFilter,
          THREE.RGBAFormat,
          THREE.UnsignedByteType,
          16
        );
        texture.needsUpdate = true;

        const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
          for (let i = 0; i < src.length; i++) {
            dst[startIndexIndex + i] = src[i] + startAttributeIndex;
          }
        };

        const menuMesh = (() => {
          const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
          });
          return new THREE.Mesh(geometry, material);
        })();
        scene.add(menuMesh);

        const boxMesh = (() => {
          const boxGeometry = (() => {
            const cylinderGeometry = new THREE.CylinderBufferGeometry(0.001, 0.001, 0.1, 32, 1);

            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(NUM_POSITIONS);
            const indices = new Uint32Array(NUM_POSITIONS);

            let attributeIndex = 0;
            let indexIndex = 0;
            const _pushGeometry = geometry => {
              const newPositions = geometry.attributes.position.array;
              positions.set(newPositions, attributeIndex);

              const newIndices = geometry.index.array;
             _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

              attributeIndex += newPositions.length;
              indexIndex += newIndices.length;
            };
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeTranslation(-0.1/2, 0, -0.1/2))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeTranslation(0.1/2, 0, -0.1/2))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeTranslation(-0.1/2, 0, 0.1/2))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeTranslation(0.1/2, 0, 0.1/2))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  new THREE.Vector3(-1, 0, 0),
                )))
                .applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.1/2, 0.1/2))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  new THREE.Vector3(-1, 0, 0),
                )))
                .applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.1/2, -0.1/2))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  new THREE.Vector3(0, 0, -1),
                )))
                .applyMatrix(new THREE.Matrix4().makeTranslation(-0.1/2, -0.1/2, 0))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  new THREE.Vector3(0, 0, -1),
                )))
                .applyMatrix(new THREE.Matrix4().makeTranslation(0.1/2, -0.1/2, 0))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  new THREE.Vector3(-1, 0, 0),
                )))
                .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.1/2, 0.1/2))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  new THREE.Vector3(-1, 0, 0),
                )))
                .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.1/2, -0.1/2))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  new THREE.Vector3(0, 0, -1),
                )))
                .applyMatrix(new THREE.Matrix4().makeTranslation(-0.1/2, 0.1/2, 0))
            );
            _pushGeometry(
              cylinderGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  new THREE.Vector3(0, 0, -1),
                )))
                .applyMatrix(new THREE.Matrix4().makeTranslation(0.1/2, 0.1/2, 0))
            );

            geometry.addAttribute('position', new THREE.BufferAttribute(positions.subarray(0, attributeIndex), 3));
            geometry.setIndex(new THREE.BufferAttribute(indices.subarray(0, indexIndex), 1));

            return geometry;
          })();

          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(NUM_POSITIONS);
          const indices = new Uint32Array(NUM_POSITIONS);

          let attributeIndex = 0;
          let indexIndex = 0;
          const _pushGeometry = geometry => {
            const newPositions = geometry.attributes.position.array;
            positions.set(newPositions, attributeIndex);

            const newIndices = geometry.index.array;
           _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

            attributeIndex += newPositions.length;
            indexIndex += newIndices.length;
          };
          for (let dy = 0; dy <= 5; dy++) {
            for (let dx = 0; dx <= 3; dx++) {
              _pushGeometry(
                boxGeometry.clone()
                  .applyMatrix(new THREE.Matrix4().makeTranslation(-WORLD_WIDTH/2 + 0.1/2 + WORLD_WIDTH*0.1 + 0.1*1.5*dx, WORLD_HEIGHT/2 - 0.1/2 - WORLD_HEIGHT*0.2 - 0.1*1.5*dy, 0.1 * 0.6))
              );
            }
          }
          for (let dy = 0; dy < 4; dy++) {
            _pushGeometry(
              boxGeometry.clone()
                .applyMatrix(new THREE.Matrix4().makeTranslation(WORLD_WIDTH/2 - 0.1/2 - WORLD_WIDTH*0.1, WORLD_HEIGHT/2 - 0.1/2 - WORLD_HEIGHT*0.2 - 0.1*1.5*dy, 0.1 * 0.6))
            );
          }
          geometry.addAttribute('position', new THREE.BufferAttribute(positions.subarray(0, attributeIndex), 3));
          geometry.setIndex(new THREE.BufferAttribute(indices.subarray(0, indexIndex), 1));

          const material = new THREE.MeshBasicMaterial({
            color: 0x000000,
          });
          return new THREE.Mesh(geometry, material);
        })();
        menuMesh.add(boxMesh);

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
