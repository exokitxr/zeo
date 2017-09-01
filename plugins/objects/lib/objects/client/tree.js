const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
// const LIGHTMAP_PLUGIN = 'plugins-lightmap';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const tree = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene} = three;

  const localVector = new THREE.Vector3();

  return () => new Promise((accept, reject) => {
    /* const trees = {};
    let Lightmapper = null;
    let lightmapper = null;
    const _bindLightmap = tree => {
      const shape = new Lightmapper.Cylinder(tree.position.x, tree.position.y, tree.position.z, 12, 8, 0.1, Lightmapper.SubBlend);
      lightmapper.add(shape);
      tree.shape = shape;
    };
    const _unbindLightmap = tree => {
      lightmapper.remove(tree.shape);
      tree.shape = null;
    };
    const lightmapElementListener = elements.makeListener(LIGHTMAP_PLUGIN);
    lightmapElementListener.on('add', entityElement => {
      Lightmapper = entityElement.Lightmapper;
      lightmapper = entityElement.lightmapper;

      for (const id in trees) {
        _bindLightmap(trees[id]);
      }
    });
    lightmapElementListener.on('remove', () => {
      Lightmapper = null;
      lightmapper = null;

      for (const id in trees) {
        trees[id].shape = null;
      }
    }); */

    const treeObjectApi = {
      object: 'tree',
      /* addedCallback(id, position) {
        const tree = {
          position: position.clone(),
          shape: null,
        };

         if (lightmapper) {
          _bindLightmap(tree);
        }

        trees[id] = tree;
      },
      removedCallback(id) {
        const tree = trees[id];

        if (lightmapper) {
          _unbindLightmap(tree);
        }

        trees[id] = null;
      }, */
      gripCallback(id, side, x, z, objectIndex) {
        const itemId = _makeId();
        const asset = 'ITEM.WOOD';
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
    objectApi.registerObject(treeObjectApi);

    accept(() => {
      elements.destroyListener(lightmapElementListener);

      objectApi.unregisterObject(treeObjectApi);
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = tree;
