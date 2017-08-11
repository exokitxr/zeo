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

  const oneVector = new THREE.Vector3(1, 1, 1);
  const zeroQuaternion = new THREE.Quaternion();
  const localVector = new THREE.Vector3();

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
    .then(sparkImg => spriteUtils.requestSpriteGeometry(
      spriteUtils.getImageData(sparkImg),
      0.015,
      new THREE.Matrix4().makeTranslation(
        (0.015 * 5 / 2) - (0.015 * 16 / 2),
        -(0.015 * 5 / 2) + (0.015 * 16 / 2),
        0
      )
    ))
    .then(sparkGeometrySpec => {
      const sparkMeshes = [];
      const _makeSparkGeometry = () => {
        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(sparkGeometrySpec.positions, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(sparkGeometrySpec.colors, 3));
        geometry.addAttribute('dy', new THREE.BufferAttribute(sparkGeometrySpec.zeroDys, 2));
        geometry.dys = sparkGeometrySpec.dys;
        geometry.zeroDys = sparkGeometrySpec.zeroDys;
        return geometry;
      };
      const _makeSparkMesh = grabbableMesh => {
        const geometry = _makeSparkGeometry();
        const material = items.getAssetsMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.update = () => {
          mesh.position.copy(grabbableMesh.position);
          mesh.rotation.copy(grabbableMesh.rotation);
          mesh.scale.copy(grabbableMesh.scale);
          mesh.matrix.copy(grabbableMesh.matrix);
          mesh.matrixWorld.copy(grabbableMesh.matrixWorld);
        };
        mesh.grab = () => {
          const dyAttribute = geometry.getAttribute('dy');
          dyAttribute.array = geometry.zeroDys;
          dyAttribute.needsUpdate = true;
        };
        mesh.release = () => {
          const dyAttribute = geometry.getAttribute('dy');
          dyAttribute.array = geometry.dys;
          dyAttribute.needsUpdate = true;
        };
        mesh.destroy = () => {
          // XXX
        };
        return mesh;
      };

      const flintSteelItemApi = {
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
          grabbable.on('grab', () => {
            if (sparkMesh) {
              sparkMesh.grab();
            }
          });
          grabbable.on('release', () => {
           if (sparkMesh) {
              sparkMesh.release();
            }
          });
          grabbable.on('data', e => {
            const {key, value} = e;

            if (key === 'ignited') {
              if (value) {
                sparkMesh = _makeSparkMesh(grabbable.mesh);
                scene.add(sparkMesh);
                sparkMeshes.push(sparkMesh);
              } else {
                scene.remove(sparkMesh);
                sparkMesh.destroy();
                sparkMeshes.splice(sparkMeshes.indexOf(sparkMesh), 1);
              }
            }
          });
          grabbable.on('collide', () => {
            if (sparkMesh) {
              const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
              localVector.set(
                grabbable.position.x,
                heightfieldElement ? heightfieldElement.getElevation(grabbable.position.x, grabbable.position.z) : 0,
                grabbable.position.z
              );
              objectApi.addObject('fire', localVector, zeroQuaternion, oneVector);

              items.destroyItem(grabbable);
            }
          });

          grabbable[dataSymbol] = {
            cleanup: () => {
              input.removeListener('triggerdown', _triggerdown);

              if (sparkMesh) {
                scene.remove(sparkMesh);
                sparkMesh.destroy();
                sparkMeshes.splice(sparkMeshes.indexOf(sparkMesh), 1);
              }
            },
          };
        },
        itemRemovedCallback(grabbable) {
          const {[dataSymbol]: {cleanup}} = grabbable;
          cleanup();

          delete grabbable[dataSymbol];
        },
      };
      items.registerItem(this, flintSteelItemApi);

      const _update = () => {
        for (let i = 0; i < sparkMeshes.length; i++) {
          sparkMeshes[i].update();
        }
      };
      render.on('update', _update);

      return () => {
        spriteUtils.releaseSpriteGeometry(sparkGeometrySpec);

        items.unregisterItem(this, flintSteelItemApi);
        render.removeListener('update', _update);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = flintSteel;
