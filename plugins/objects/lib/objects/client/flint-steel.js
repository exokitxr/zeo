const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const flintSteel = objectApi => {
  const {three, pose, input, render, elements, items, utils: {sprite: spriteUtils}} = zeo;
  const {THREE, scene, camera} = three;

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

  return () => _requestImage('/archae/objects/img/spark.png')
    .then(sparkImg => spriteUtils.requestSpriteGeometry(spriteUtils.getImageData(sparkImg), 0.015))
    .then(sparkGeometrySpec => {
      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(sparkGeometrySpec.positions, 3));
      // geometry.addAttribute('position', new THREE.BufferAttribute(sparkGeometrySpec.normals, 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(sparkGeometrySpec.colors, 3));
      geometry.addAttribute('dy', new THREE.BufferAttribute(sparkGeometrySpec.zeroDys, 2));
      return geometry;
    })
    .then(sparkGeometry => {
      const _makeSparkMesh = () => {
        const geometry = sparkGeometry;
        const material = items.getAssetsMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.destroy = () => {
          // XXX
        };
        return mesh;
      };

      const stickItemApi = {
        asset: 'ITEM.FLINTSTEEL',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              grabbable.setData('ignited', true);

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);

          let sparkMesh = null;
          grabbable.on('data', e => {
            const {key, value} = e;

            console.log('got data', {key, value});

            if (key === 'ignited') {
              if (value) {
                sparkMesh = _makeSparkMesh();
                scene.add(sparkMesh);
              } else {
                scene.remove(sparkMesh);
                sparkMesh.destroy();
              }
            }
          });
          grabbable.on('update', () => {
            if (sparkMesh) {
              sparkMesh.position.copy(grabbable.mesh.position);
              sparkMesh.rotation.copy(grabbable.mesh.rotation);
              sparkMesh.scale.copy(grabbable.mesh.scale);
              sparkMesh.matrix.copy(grabbable.mesh.matrix);
              sparkMesh.matrixWorld.copy(grabbable.mesh.matrixWorld);
            }
          });
          grabbable.on('destroy', () => {
            if (sparkMesh) {
              scene.remove(sparkMesh);
              sparkMesh.destroy();
            }
          });

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
      items.registerItem(this, stickItemApi);

      return () => {
        items.unregisterItem(this, stickItemApi);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = flintSteel;
