const ThreeExtraMirror = require('./lib/three-extra/Mirror');

const PORTAL_SIZE = 1;
const PORTAL_BORDER_SIZE = PORTAL_SIZE * 0.01;

class Mirror {
  mount() {
    return;
    const {three: {THREE, scene, camera, renderer}, elements, render, pose, utils: {geometry: geometryUtils}} = zeo;

    const THREEMirror = ThreeExtraMirror(THREE);

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, quaternion, scale);
      return {position, quaternion, scale};
    };

    const updateEyes = [];
    const _updateEye = camera => {
      for (let i = 0; i < updateEyes.length; i++) {
        const updateEye = updateEyes[i];
        updateEye(camera);
      }
    };
    render.on('updateEye', _updateEye);

    const mirrorEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 1, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        color: {
          type: 'color',
          value: '#808080',
        },
      },
      entityAddedCallback(entityElement) {
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
            const material = new THREE.MeshBasicMaterial({
              color: color,
              side: THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(outer);
          object.outer = outer;

          return object;
        })();
        scene.add(mirrorMesh);
        entityElement.mirrorMesh = mirrorMesh;

        const updateEye = camera => {
          const {name: side} = camera;
          const renderTarget = renderTargets[side];
          mirrorMesh.inner.renderEye(renderer, scene, camera, renderTarget);
        };
        updateEyes.push(updateEye);

        entityElement._cleanup = () => {
          scene.remove(mirrorMesh);

          updateEyes.splice(updateEyes.indexOf(updateEye), 1);
        };
      },
      entityRemovedCallback(entityElement) {
        entityElement._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        switch (name) {
          case 'position': {
            const {mirrorMesh} = entityElement;

            mirrorMesh.position.set(newValue[0], newValue[1], newValue[2]);
            mirrorMesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            mirrorMesh.scale.set(newValue[7], newValue[8], newValue[9]);
            mirrorMesh.updateMatrixWorld();

            break;
          }
          case 'color': {
            const {mirrorMesh} = entityElement;
            const {objectMesh} = mirrorMesh;
            const {outer, back} = objectMesh;
            const materials = [outer.material, back.material];

            for (let i = 0; i < materials.length; i++) {
              const material = materials[i];
              material.color = new THREE.Color(newValue);
            }

            break;
          }
        }
      },
    };
    elements.registerEntity(this, mirrorEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, mirrorEntity);

      render.removeListener('updateEye', _updateEye);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Mirror;
