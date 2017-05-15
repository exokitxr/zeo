const {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,

  PORT,
} = require('./lib/constants/constants');
const novnc = require('retroarch/client.js');

class Retroarch {
  mount() {
    const {three: {THREE, scene}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const retroarchComponent = {
      selector: 'retroarch[position]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 1.5, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const screenMesh = (() => {
          const canvas = document.createElement('canvas');
          canvas.width = WIDTH;
          canvas.height = HEIGHT;
          setTimeout(() => {
            const c = novnc.connect({
              canvas: canvas,
              host: document.location.hostname,
              port: PORT,
              path: '/',
              ondisconnect: () => {
                console.warn('disconnected');
              },
            });
          }, 1000);

          // XXX
          /* document.body.addEventListener('keydown', e => {
            c.handleKeydown(e);
          });
          document.body.addEventListener('keypress', e => {
            c.handleKeypress(e);
          });
          document.body.addEventListener('keyup', e => {
            c.handleKeyup(e);
          }); */

          const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);
          const texture = new THREE.Texture(
            canvas,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.NearestFilter,
            THREE.NearestFilter,
            THREE.RGBFormat,
            THREE.UnsignedByteType,
            16
          );
          texture.needsUpdate = true;
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
          });

          const mesh = new THREE.Mesh(geometry, material);
          return mesh;
        })();
        entityObject.add(screenMesh);

        const _update = () => {
          const {
            material: {
              map: texture,
            },
          } = screenMesh;
          texture.needsUpdate = true;
        };
        render.on('update', _update);

        entityApi._cleanup = () => {
          entityObject.remove(screenMesh);

          render.removeListener('update', _update);
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        switch (name) {
          case 'position': {
            const position = newValue;

            if (position) {
              entityObject.position.set(position[0], position[1], position[2]);
              entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
              entityObject.scale.set(position[7], position[8], position[9]);
            }

            break;
          }
        }
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
    };
    elements.registerComponent(this, retroarchComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, retroarchComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Retroarch;
