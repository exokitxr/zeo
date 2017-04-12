const ThreeExtraMirror = require('./lib/three-extra/Mirror');

const PORTAL_SIZE = 1;
const PORTAL_BORDER_SIZE = PORTAL_SIZE * 0.01;

class Mirror {
  mount() {
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

    const mirrorComponent = {
      selector: 'mirror[position][color]',
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
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const mirrorMesh = (() => {
          const result = new THREE.Object3D();

          const width = PORTAL_SIZE / 2;
          const height = PORTAL_SIZE;
          const border = PORTAL_BORDER_SIZE;
          const color = 0x808080;
          const rendererSize = renderer.getSize();
          const rendererPixelRatio = renderer.getPixelRatio();
          const resolutionWidth = rendererSize.width * rendererPixelRatio;
          const resolutionHeight = rendererSize.height * rendererPixelRatio;

          const objectMesh = (() => {
            const object = new THREE.Object3D();

            const inner = (() => {
              const mirror = new THREEMirror(width, height, {
                clipBias: 0.003,
                textureWidth: resolutionWidth,
                textureHeight: resolutionHeight,
                color: 0x808080,
              });
              return mirror;
            })();
            object.add(inner);
            object.inner = inner;

            const outer = (() => {
              if (border > 0) {
                const geometry = (() => {
                  const leftGeometry = new THREE.BoxBufferGeometry(border, height, border);
                  leftGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(-(width / 2) - (border / 2), 0, -(border / 2)));

                  const rightGeometry = new THREE.BoxBufferGeometry(border, height, border);
                  rightGeometry.applyMatrix(new THREE.Matrix4().makeTranslation((width / 2) + (border / 2), 0, -(border / 2)));

                  const topGeometry = new THREE.BoxBufferGeometry(width + (border * 2), border, border);
                  topGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, (height / 2) + (border / 2), -(border / 2)));

                  const bottomGeometry = new THREE.BoxBufferGeometry(width + (border * 2), border, border);
                  bottomGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -(height / 2) - (border / 2), -(border / 2)));

                  const bufferGeometry = geometryUtils.concatBufferGeometry([
                    leftGeometry,
                    rightGeometry,
                    topGeometry,
                    bottomGeometry,
                  ]);
                  return bufferGeometry;
                })();
                const material = new THREE.MeshPhongMaterial({
                  color: color,
                });

                const mesh = new THREE.Mesh(geometry, material);
                return mesh;
              } else {
                const mesh = new THREE.Object3D();
                return mesh;
              }
            })();
            object.add(outer);
            object.outer = outer;

            const back = (() => {
              const geometry = (() => {
                const {geometry: innerGeometry} = inner;
                const bufferGeometry = innerGeometry.clone();
                bufferGeometry.applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));
                bufferGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(border / 2)));
                return bufferGeometry;
              })();
              const material = new THREE.MeshPhongMaterial({
                color: color,
                side: THREE.DoubleSide,
              });
              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(back);
            object.back = back;

            return object;
          })();
          result.add(objectMesh);
          result.objectMesh = objectMesh;

          return result;
        })();
        entityObject.add(mirrorMesh);
        entityApi.mirrorMesh = mirrorMesh;

        const updateEye = eyeCamera => {
          const {objectMesh} = mirrorMesh;
          const {inner} = objectMesh;

          inner.renderEye(renderer, scene, eyeCamera);
          renderer.setRenderTarget(null);
        };
        updateEyes.push(updateEye);

        entityApi._cleanup = () => {
          entityObject.remove(mirrorMesh);

          updateEyes.splice(updateEyes.indexOf(updateEye), 1);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'position': {
            const {mirrorMesh} = entityApi;

            mirrorMesh.position.set(newValue[0], newValue[1], newValue[2]);
            mirrorMesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            mirrorMesh.scale.set(newValue[7], newValue[8], newValue[9]);

            break;
          }
          case 'color': {
            const {mirrorMesh} = entityApi;
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
    elements.registerComponent(this, mirrorComponent);

    render.on('updateEye', _updateEye);

    this._cleanup = () => {
      elements.unregisterComponent(this, mirrorComponent);

      render.removeListener('updateEye', _updateEye);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Mirror;
