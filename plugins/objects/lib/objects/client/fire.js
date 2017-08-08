const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const fire = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene} = three;

  const localVector = new THREE.Vector3();
  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);

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

  return () => _requestImage('/archae/objects/img/fire.png')
    .then(fireImg => objectApi.registerTexture('fire', fireImg))
    .then(() => objectApi.registerGeometry('fire', (args) => {
      const {THREE, getUv} = args;
      const fireUvs = getUv('fire');
      const fireUvWidth = fireUvs[2] - fireUvs[0];
      const fireUvHeight = fireUvs[3] - fireUvs[1];

      const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
      const positions = geometry.getAttribute('position').array;
      const uvs = geometry.getAttribute('uv').array;

      const numUvs = uvs.length / 2;
      for (let i = 0; i < numUvs; i++) {
        uvs[i * 2 + 0] = fireUvs[0] + (uvs[i * 2 + 0] * fireUvWidth);
        uvs[i * 2 + 1] = (fireUvs[1] + fireUvHeight) - (uvs[i * 2 + 1] * fireUvHeight);
      }

      const numPositions = positions.length;
      const frames = new Float32Array(numPositions);
      for (let i = 0; i < numPositions; i++) {
        const baseIndex = i * 3;
        frames[baseIndex + 0] = fireUvs[1];
        frames[baseIndex + 1] = fireUvHeight / 8;
        frames[baseIndex + 2] = 8;
      }
      geometry.addAttribute('frame', new THREE.BufferAttribute(frames, 3));

      return geometry;
    }))
    .then(() => {
      const fireItemApi = {
        asset: 'ITEM.FIRE',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
              localVector.set(
                grabbable.position.x,
                heightfieldElement ? heightfieldElement.getElevation(grabbable.position.x, grabbable.position.z) : 0,
                grabbable.position.z
              );
              objectApi.addObject('fire', localVector, zeroQuaternion, oneVector);

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
      items.registerItem(this, fireItemApi);

      const fireObjectApi = {
        object: 'fire',
        offset: [0, 1/2, 0],
        size: 0.5,
        objectAddedCallback(object) {
          object.on('grip', side => {
            const id = _makeId();
            const asset = 'ITEM.FIRE';
            const assetInstance = items.makeItem({
              type: 'asset',
              id: id,
              name: asset,
              displayName: asset,
              attributes: {
                position: {value: DEFAULT_MATRIX},
                asset: {value: asset},
                quantity: {value: 1},
                owner: {value: null},
                bindOwner: {value: null},
                physics: {value: false},
              },
            });
            assetInstance.grab(side);

            object.remove();
          });

          object.shape = null;
          if (lightmapper) {
            _bindLightmap(object);
          }

          fires.push(object);
        },
        objectRemovedCallback(object) {
          if (lightmapper) {
            _unbindLightmap(object);
          }

          fires.splice(fires.indexOf(object), 1);
        },
      };
      objectApi.registerObject(fireObjectApi);

      const fires = [];
      let Lightmapper = null;
      let lightmapper = null;
      const _bindLightmap = fire => {
        const shape = new Lightmapper.Sphere(fire.position.x, fire.position.y, fire.position.z, 8, 2, Lightmapper.MaxBlend);
        lightmapper.add(shape);
        fire.shape = shape;
      };
      const _unbindLightmap = fire => {
        lightmapper.remove(fire.shape);
        fire.shape = null;
      };
      const lightmapElementListener = elements.makeListener(LIGHTMAP_PLUGIN); // XXX destroy this
      lightmapElementListener.on('add', entityElement => {
        Lightmapper = entityElement.Lightmapper;
        lightmapper = entityElement.lightmapper;

        for (let i = 0; i < fires.length; i++) {
          _bindLightmap(fires[i]);
        }
      });
      lightmapElementListener.on('remove', () => {
        Lightmapper = null;
        lightmapper = null;

        for (let i = 0; i < fires.length; i++) {
          fires[i].shape = null;
        }
      });

      return () => {
        items.unregisterItem(this, fireItemApi);
        objectApi.unregisterObject(fireObjectApi);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = fire;
