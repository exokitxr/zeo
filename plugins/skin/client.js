class Skin {
  mount() {
    const {player, items, utils: {skin: skinUtils}} = zeo;
    const {skin} = skinUtils;

    let _cancel = null;
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
        img.src = 'data:image/png;base64,' + assetSpec.skin.data;
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
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Skin;
