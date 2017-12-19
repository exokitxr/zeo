class SkinVr {
  mount() {
    const {three, player, elements, items, utils: {skin: skinUtils}} = zeo;
    const {scene} = three;
    const {skin} = skinUtils;

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });

    return _requestImage('/archae/plugins/skin-vr/serve/male.png')
      .then(skinImg => {
        let mesh = null;
        const skinEntity = {
          attributes: {},
          entityAddedCallback(entityElement) {
            mesh = skin(skinImg);
            scene.add(mesh);
          },
          entityRemovedCallback(entityElement) {
            scene.remove(mesh);
          },
          /* entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
            console.log('entityAttributeValueChangedCallback', {entityElement, name, oldValue, newValue});
          }, */
        };
        elements.registerEntity(this, skinEntity);

        this._cleanup = () => {
          elements.unregisterEntity(this, skinEntity);
        };

        /* let _cancel = null;
        const skinApi = {
          asset: 'ITEM.SKIN',
          equipmentAddedCallback(assetSpec) {
            let live = true;
            const img = new Image();
            img.onload = () => {
              if (live) {
                player.setSkin(img);

                _cancel = () => {
                  player.setSkin(null);
                };
              }
            };
            img.onerror = err => {
              console.warn(err);

              _cancel = () => {};
            };
            img.src = 'data:image/png;base64,' + assetSpec.json.data;
            _cancel = () => {
              live = false;
            };
          },
          equipmentRemovedCallback() {
            _cancel();
            _cancel = null;
          },
        };
        items.registerEquipment(this, skinApi);

        this._cleanup = () => {
          items.unregisterEquipment(this, skinApi);
        }; */
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = SkinVr;
