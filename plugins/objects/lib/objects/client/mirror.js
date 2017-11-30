const ThreeExtraMirror = require('../../three-extra/Mirror');

const NUM_POSITIONS = 10 * 1024;
const PORTAL_SIZE = 2;
const PORTAL_BORDER_SIZE = PORTAL_SIZE * 0.1;
const width = PORTAL_SIZE / 2;
const height = PORTAL_SIZE;
const border = PORTAL_BORDER_SIZE;
const HEIGHTFIELD_PLUGIN = 'heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const mirror = objectApi => {
  const {three, elements, render, input, pose, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const localVector = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

  const THREEMirror = ThreeExtraMirror(THREE);

  return () => new Promise((accept, reject) => {
    const rendererSize = renderer.getSize();
    const rendererPixelRatio = renderer.getPixelRatio();
    const resolutionWidth = rendererSize.width * rendererPixelRatio;
    const resolutionHeight = rendererSize.height * rendererPixelRatio;

    const offsetVector = new THREE.Vector3(0, height/2 + PORTAL_BORDER_SIZE/2, 0);

    const _makeRenderTarget = () => {
      const renderTarget = new THREE.WebGLRenderTarget(resolutionWidth, resolutionHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBFormat,
        stencilBuffer: false,
        // depthBuffer: false,
      });
      renderTarget.textureMatrix = new THREE.Matrix4();
      return renderTarget;
    };

    const mirrorItemApi = {
      asset: 'ITEM.MIRROR',
      itemAddedCallback(grabbable) {
        const _triggerdown = e => {
          const {side} = e;

          if (grabbable.getGrabberSide() === side) {
            const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
            localVector.copy(grabbable.position);
            localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
            localEuler.x = 0;
            localEuler.z = 0;
            localQuaternion.setFromEuler(localEuler);
            objectApi.addObject('mirror', localVector, localQuaternion);

            items.destroyItem(grabbable);

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerdown', _triggerdown);

        grabbable[dataSymbol] = {
          cleanup: () => {
            input.removeListener('triggerdown', _triggerdown);
          },
        };
      },
      itemRemovedCallback(grabbable) {
        const {[dataSymbol]: {cleanup}} = grabbable;
        cleanup();

        delete grabbable[dataSymbol];
      },
    };
    items.registerItem(this, mirrorItemApi);

    const mirrors = {};
    const mirrorObjectApi = {
      object: 'mirror',
      addedCallback(id, position, rotation) {
        const renderTargets = {
          left: _makeRenderTarget(),
          right: _makeRenderTarget(),
        };
        const mirrorMesh = new THREEMirror(width, height, {
          clipBias: 0.003,
          textureWidth: resolutionWidth,
          textureHeight: resolutionHeight,
          color: 0x808080,
          renderTargets,
        });
        mirrorMesh.position.copy(position)
          .add(offsetVector);
        mirrorMesh.quaternion.copy(rotation);
        // mirrorMesh.scale.copy(scale);
        scene.add(mirrorMesh);
        mirrorMesh.updateMatrixWorld();

        const updateEye = camera => {
          mirrorMesh.renderEye(renderer, scene, camera, renderTargets[camera.name]);
        };
        updateEyes.push(updateEye);

        const mirror = {
          cleanup() {
            scene.remove(mirrorMesh);
            renderTargets.left.dispose();
            renderTargets.right.dispose();

            updateEyes.splice(updateEyes.indexOf(updateEye), 1);
          },
        };
        mirrors[id] = mirror;
      },
      removedCallback(id) {
        mirrors[id].cleanup();
      },
      gripCallback(id, side, x, z, objectIndex) {
        const itemId = _makeId();
        const asset = 'ITEM.MIRROR';
        const assetInstance = items.makeItem({
          type: 'asset',
          id: itemId,
          name: asset,
          displayName: asset,
          attributes: {
            type: {value: 'asset'},
            value: {value: asset},
            position: {value: DEFAULT_MATRIX},
            quantity: {value: 1},
            owner: {value: null},
            bindOwner: {value: null},
            physics: {value: false},
          },
        });
        assetInstance.grab(side);

        objectApi.removeObject(x, z, objectIndex);
      },
    };
    objectApi.registerObject(mirrorObjectApi);

    const mirrorRecipe = {
      output: 'ITEM.MIRROR',
      width: 2,
      height: 3,
      input: [
        'ITEM.WOOD', 'ITEM.WOOD',
        'ITEM.WOOD', 'ITEM.WOOD',
        'ITEM.WOOD', 'ITEM.WOOD',
      ],
    };
    objectApi.registerRecipe(mirrorRecipe);

    const updateEyes = [];
    const _updateEye = camera => {
      for (let i = 0; i < updateEyes.length; i++) {
        updateEyes[i](camera);
      }
    };
    render.on('updateEye', _updateEye);

    accept(() => {
      objectApi.unregisterObject(mirrorObjectApi);
      objectApi.unregisterRecipe(mirrorRecipe);

      render.removeListener('updateEye', _updateEye);
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = mirror;
