const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const torch = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene, camera} = three;

  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const localVector = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

  const _requestImage = src => new Promise((accept, reject) => {
    const img = new Image();
    img.onload = () => {
      accept(img);
    };
    img.onerror = err => {
      reject(img);
    };
    img.src = src;
  });

  return () => _requestImage('/archae/objects/img/torch.png')
    .then(torchImg => objectApi.registerTexture('torch', torchImg))
    .then(() => objectApi.registerGeometry('torch', (args) => {
      const {THREE, getUv} = args;
      const torchUvs = getUv('torch');
      const subUvs = [6/16, 0/16, 10/16, 16/16];
      const torchSubUvs = _getSubUvs(torchUvs, subUvs);
      const uvWidth = torchSubUvs[2] - torchSubUvs[0];
      const uvHeight = torchSubUvs[3] - torchSubUvs[1];

      const geometry = new THREE.BoxBufferGeometry(0.05, 0.3, 0.05)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.1, 0));
      const uvs = geometry.getAttribute('uv').array;
      const numUvs = uvs.length / 2;
      for (let i = 0; i < numUvs; i++) {
        uvs[i * 2 + 0] = torchSubUvs[0] + (uvs[i * 2 + 0] * uvWidth);
        uvs[i * 2 + 1] = (torchSubUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
      }

      function _getSubUvs(a, b) {
        const uvWidthA = a[2] - a[0];
        const uvHeightA = a[3] - a[1];
        return [
          a[0] + (b[0] * uvWidthA),
          a[1] + (b[1] * uvHeightA),
          a[0] + (b[2] * uvWidthA),
          a[1] + (b[3] * uvHeightA),
        ];
      }

      return geometry;
    }))
    .then(() => {
      const torchItemApi = {
        asset: 'ITEM.TORCH',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
              localVector.set(
                grabbable.position.x,
                heightfieldElement ? heightfieldElement.getBestElevation(grabbable.position.x, grabbable.position.z, grabbable.position.y) : 0,
                grabbable.position.z
              );
              localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
              localEuler.x = 0;
              localEuler.z = 0;
              localQuaternion.setFromEuler(localEuler);
              objectApi.addObject('torch', localVector, localQuaternion);

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
      items.registerItem(this, torchItemApi);

      const torches = {};
      let Lightmapper = null;
      let lightmapper = null;
      const _bindLightmap = torch => {
        const shape = new Lightmapper.Sphere(torch.position.x, torch.position.y, torch.position.z, 8, 2, Lightmapper.MaxBlend);
        lightmapper.add(shape);
        torch.shape = shape;
      };
      const _unbindLightmap = torch => {
        lightmapper.remove(torch.shape);
        torch.shape = null;
      };
      const lightmapElementListener = elements.makeListener(LIGHTMAP_PLUGIN);
      lightmapElementListener.on('add', entityElement => {
        Lightmapper = entityElement.Lightmapper;
        lightmapper = entityElement.lightmapper;

        for (const id in torches) {
          _bindLightmap(torches[id]);
        }
      });
      lightmapElementListener.on('remove', () => {
        Lightmapper = null;
        lightmapper = null;

        for (const id in torches) {
          torches[id].shape = null;
        }
      });

      const torchObjectApi = {
        object: 'torch',
        addedCallback(id, position) {
          const torch = {
            position,
            shape: null,
          };

          if (lightmapper) {
            _bindLightmap(torch);
          }

          torches[id] = torch;
        },
        removedCallback(id) {
          const torch = torches[id];

          if (lightmapper) {
            _unbindLightmap(torch);
          }

          torches[id] = torch;
        },
        gripCallback(id, side, x, z, objectIndex) {
          const itemId = _makeId();
          const asset = 'ITEM.TORCH';
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
      objectApi.registerObject(torchObjectApi);

      const torchRecipe = {
        output: 'ITEM.TORCH',
        width: 1,
        height: 3,
        input: [
          'ITEM.COAL',
          'ITEM.WOOD',
          'ITEM.WOOD',
        ],
      };
      objectApi.registerRecipe(this, torchRecipe);

      return () => {
        elements.destroyListener(lightmapElementListener);

        items.unregisterItem(this, torchItemApi);
        objectApi.unregisterObject(torchObjectApi);

        objectApi.unregisterRecipe(this, torchRecipe);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = torch;
