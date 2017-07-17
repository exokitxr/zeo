const THREEMirrorLib = require('../three-extra/Mirror');

const PORTAL_SIZE = 1;
const PORTAL_BORDER_SIZE = PORTAL_SIZE * 0.01;

const dataSymbol = Symbol();

const mirror = ({archae}) => {
  const {three, elements, pose, input, render, teleport, items, utils: {geometry: geometryUtils}} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const THREEMirror = THREEMirrorLib(THREE);

  return () => {

    const borderMaterial = new THREE.MeshPhongMaterial({
      color: 0x795548,
      side: THREE.DoubleSide,
    });

    const mirrorApi = {
      asset: 'ITEM.MIRROR',
      itemAddedCallback(grabbable) {
        const mirrorMesh = (() => {
          const object = new THREE.Object3D();
          object.visible = false;

          const width = PORTAL_SIZE / 2;
          const height = PORTAL_SIZE;
          const border = PORTAL_BORDER_SIZE;
          const color = 0x808080;
          const rendererSize = renderer.getSize();
          const rendererPixelRatio = renderer.getPixelRatio();
          const resolutionWidth = rendererSize.width * rendererPixelRatio;
          const resolutionHeight = rendererSize.height * rendererPixelRatio;

          const inner = new THREEMirror(width, height, {
            clipBias: 0.003,
            textureWidth: resolutionWidth,
            textureHeight: resolutionHeight,
            color: 0x808080,
          });
          object.add(inner);
          object.inner = inner;

          const outer = (() => {
            const geometry = (() => {
              const leftGeometry = new THREE.BoxBufferGeometry(border, height, border);
              leftGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(-(width / 2) - (border / 2), 0, -(border / 2)));

              const rightGeometry = new THREE.BoxBufferGeometry(border, height, border);
              rightGeometry.applyMatrix(new THREE.Matrix4().makeTranslation((width / 2) + (border / 2), 0, -(border / 2)));

              const topGeometry = new THREE.BoxBufferGeometry(width + (border * 2), border, border);
              topGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, (height / 2) + (border / 2), -(border / 2)));

              const bottomGeometry = new THREE.BoxBufferGeometry(width + (border * 2), border, border);
              bottomGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -(height / 2) - (border / 2), -(border / 2)));

              const backGeometry = inner.geometry.clone();
              backGeometry.applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));
              backGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(border / 2)));

              return geometryUtils.concatBufferGeometry([
                leftGeometry,
                rightGeometry,
                topGeometry,
                bottomGeometry,
                backGeometry,
              ]);
            })();
            const material = borderMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(outer);
          object.outer = outer;

          return object;
        })();
        scene.add(mirrorMesh);

        let grabbed = false;
        const _grab = () => {
          grabbed = true;

          grabbable.hide();
          mirrorMesh.visible = true;
        };
        grabbable.on('grab', _grab);
        const _release = () => {
          grabbed = false;

          grabbable.show();
          mirrorMesh.visible = false;
        };
        grabbable.on('release', _release);
        const _update = ({position, rotation, scale}) => {
          if (grabbed) {
            mirrorMesh.position.fromArray(position);
            mirrorMesh.quaternion.fromArray(rotation);
            mirrorMesh.scale.fromArray(scale);
            mirrorMesh.updateMatrixWorld();
          }
        };
        grabbable.on('update', _update);

        grabbable[dataSymbol] = {
          cleanup: () => {
            scene.remove(mirrorMesh);
            mirrorMesh.destroy();

            grabbable.removeListener('grab', _grab);
            grabbable.removeListener('release', _release);
            grabbable.removeListener('update', _update);
          },
        };
      },
      itemRemovedCallback(grabbable) {
        const {[dataSymbol]: {cleanup}} = grabbable;
        cleanup();
      },
    };
    items.registerItem(this, mirrorApi);

    return () => {
      borderMaterial.dispose();

      items.unregisterItem(this, mirrorApi);
    };
  };
}

module.exports = mirror;
