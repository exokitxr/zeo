const minecraftSkin = require('./lib/minecraft-skin');

class Skin {
  mount() {
    const {three: {THREE}, elements} = zeo;

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

    return _requestImage('/archae/skin/img/groot.png')
    // return _requestImage('/archae/skin/img/natsuwithfire.png')
      .then(skinImg => {
        if (live) {
          const skinComponent = {
            selector: 'skin[position]',
            attributes: {
              position: {
                type: 'matrix',
                value: [
                  0, 0, -2,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              },
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();
              const entityObject = entityElement.getObject();

              const scale = 1 / 18;
              const skin = minecraftSkin(THREE, skinImg, {
                scale: new THREE.Vector3(scale, scale, scale),
              });
              const {mesh} = skin;
              entityObject.add(mesh);

              entityApi._cleanup = () => {
                entityObject.remove(mesh);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getComponentApi();

              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
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
          };
          elements.registerComponent(this, skinComponent);

          this._cleanup = () => {
            elements.unregisterComponent(this, skinComponent);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Skin;
