const THREEMirrorLib = require('../three-extra/Mirror');

const PORTAL_SIZE = 1;
const PORTAL_BORDER_SIZE = PORTAL_SIZE * 0.01;

const dataSymbol = Symbol();

const mirror = ({archae}) => {
  const {three, elements, pose, input, render, stage, items, utils: {geometry: geometryUtils}} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const THREEMirror = THREEMirrorLib(THREE);

  const width = PORTAL_SIZE / 2;
  const height = PORTAL_SIZE;
  const border = PORTAL_BORDER_SIZE;
  const color = 0x808080;
  const rendererSize = renderer.getSize();
  const rendererPixelRatio = renderer.getPixelRatio();
  const resolutionWidth = rendererSize.width * rendererPixelRatio;
  const resolutionHeight = rendererSize.height * rendererPixelRatio;

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
  const renderTargets = {
    left: _makeRenderTarget(),
    right: _makeRenderTarget(),
  };

  const mirrorMesh = (() => {
    const object = new THREE.Object3D();
    object.visible = false;

    const inner = new THREEMirror(width, height, {
      clipBias: 0.003,
      textureWidth: resolutionWidth,
      textureHeight: resolutionHeight,
      color: 0x808080,
      renderTargets,
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
      const material = new THREE.MeshPhongMaterial({
        color: 0x795548,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);

      mesh.destroy = () => {
        geometry.dispose();
        material.dispose();
      };

      return mesh;
    })();
    object.add(outer);
    object.outer = outer;

    object.destroy = () => {
      inner.destroy();
      outer.destroy();
    };

    return object;
  })();
  stage.add('blank', mirrorMesh);

  const _updateEye = camera => {
    const {name: side} = camera;
    const renderTarget = renderTargets[side];
    mirrorMesh.inner.renderEye(renderer, scene, camera, renderTarget);
  };
  render.on('updateEye', _updateEye);

  renderer.compile(scene, camera);

  return () => {
    const mirrorApi = {
      asset: 'ITEM.MIRROR',
      itemAddedCallback(grabbable) {
        const _grab = () => {
          if (stage.getStage() === 'blank') {
            stage.setStage('main');

            grabbable.show();
            grabbable.enablePhysics();
            mirrorMesh.visible = false;
          }
        };
        grabbable.on('grab', _grab);

        stage.on('stage', stage => {
          if (stage !== 'blank' && !grabbable.isVisible()) {
            grabbable.show();
          } else if (stage === 'blank' && grabbable.isVisible()) {
            grabbable.hide();
          }
        });

        const _triggerdown = e => {
          if (grabbable.isGrabbed()) {
            const {position, rotation, scale} = grabbable;
            mirrorMesh.position.copy(position);
            mirrorMesh.quaternion.copy(rotation);
            mirrorMesh.scale.copy(scale);
            mirrorMesh.updateMatrixWorld();
            mirrorMesh.visible = true;

            stage.setStage('blank');

            grabbable.release();
            grabbable.hide();
            grabbable.disablePhysics();

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerdown', _triggerdown);

        grabbable[dataSymbol] = {
          cleanup: () => {
            grabbable.removeListener('grab', _grab);
            input.removeListener('triggerdown', _triggerdown);
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
      stage.remove('blank', mirrorMesh);
      mirrorMesh.destroy();
      renderTargets.left.dispose();
      renderTargets.right.dispose();

      render.removeListener('updateEye', _updateEye);

      items.unregisterItem(this, mirrorApi);
    };
  };
}

module.exports = mirror;
