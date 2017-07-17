const dataSymbol = Symbol();

const torch = ({archae}) => {
  const {three, pose, input, render, teleport, items} = zeo;
  const {THREE, scene} = three;

  return () => {
    const torchApi = {
      asset: 'TORCH',
      itemAddedCallback(grabbable) {
        const dotMesh = (() => {
          const geometry = new THREE.TorusBufferGeometry(0.05, 0.01, 3, 6)
            .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
          const material = polygonMeshMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;

          mesh.destroy = () => {
            geometry.dispose();
          };

          return mesh;
        })();
        scene.add(dotMesh);

        let grabbed = false;
        let placing = false;
        const _triggerdown = e => {
          if (grabbed) {
            placing = true;

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerdown', _triggerdown);
        const _triggerup = e => {
          if (placing) {
            placing = false;

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerup', _triggerup);
        const _grab = e => {
          grabbed = true;
        };
        grabbable.on('grab', _grab);
        const _release = e => {
          grabbed = false;
          placing = false;
        };
        grabbable.on('release', _release);

        const _update = () => {
          if (placing) {
            const grabbablePosition = new THREE.Vector3().fromArray(grabbable.position);
            const grabbableRotation = new THREE.Quaternion().fromArray(grabbable.rotation);
            const grabbableScale = new THREE.Vector3(1, 1, 1).fromArray(grabbable.scale);
            const hoverState = teleport.getHoverState(grabbable.getGrabberSide());
            const {position} = hoverState;

            if (position) {
              const {normal} = hoverState;

              dotMesh.position.copy(position);
              dotMesh.quaternion.setFromUnitVectors(
                upVector,
                normal
              );
              dotMesh.updateMatrixWorld();

              if (!dotMesh.visible) {
                dotMesh.visible = true;
              }
            } else {
              if (dotMesh.visible) {
                dotMesh.visible = false;
              }
            }
          } else {
            if (dotMesh.visible) {
              dotMesh.visible = false;
            }
          }
        };
        render.on('update', _update);

        const _cleanup = () => {
          scene.remove(dotMesh);
          dotMesh.destroy();

          input.removeListener('triggerdown', _triggerdown);
          input.removeListener('triggerup', _triggerup);

          grabbable.removeListener('grab', _grab);
          grabbable.removeListener('release', _release);

          render.removeListener('update', _update);
        };

        grabbable[dataSymbol] = {
          cleanup: _cleanup,
        };
      },
      itemRemovedCallback(grabbable) {
        const {[dataSymbol]: {cleanup}} = grabbable;
        cleanup();

        delete grabbable[dataSymbol];
      },
    };

    items.registerItem(this, torchApi);

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
    items.registerRecipe(this, torchRecipe);

    return () => {
      items.unregisterItem(this, torchApi);
      items.unregisterRecipe(this, torchRecipe);
    };
  };
};

module.exports = torch;
