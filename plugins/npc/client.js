const skin = require('./lib/skin');

class Npc {
  mount() {
    const {three, elements} = zeo;
    const {THREE, scene} = three;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImage = url => new Promise((accept, reject) => {
      const img = new Image();

      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(img);
      };

      img.crossOrigin = 'Anonymous';
      img.src = url;
    });
    const meshes = [];

    class FakeStatus {
      constructor(hmd, controllers) {
        this.hmd = hmd;
        this.controllers = controllers;
      }
    }
    class FakeStatusProperties {
      constructor(position, rotation, scale) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
      }
    }
    class FakeControllersStatus {
      constructor(left, right) {
        this.left = left;
        this.right = right;
      }
    }

    return _requestImage('/archae/npc/img/9')
      .then(skinImg => {
        if (live) {
          const _makeMesh = skinImg => skin(THREE, skinImg);

          const skinEntity = {
            entityAddedCallback(entityElement) {
              const mesh = _makeMesh(skinImg);
              mesh.position.set(-2, 30, 0);
              mesh.updateMatrixWorld();
              scene.add(mesh);

              entityElement.cleanup = () => {
                scene.remove(mesh);
                // mesh.destroy();
              };
            },
            entityRemovedCallback(entityElement) {
              entityElement.cleanup();
            },
          };
          elements.registerEntity(this, skinEntity);

          this._cleanup = () => {
            elements.unregisterEntity(this, skinEntity);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Npc;
