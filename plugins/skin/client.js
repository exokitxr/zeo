class Skin {
  mount() {
    const {player, items, utils: {skin: skinUtils}} = zeo;
    const {skin} = skinUtils;

    const _requestImage = url => new Promise((accept, reject) => {
      const img = new Image();
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(img);
      };
      img.src = url;
    });

    let _cancel = null;
    const skinApi = {
      asset: 'ITEM.SKIN',
      equipmentAddedCallback() {
        let live = true;
        _requestImage('/archae/skin/img/darkvortexity.png')
          // _requestImage('/archae/skin/img/groot.png')
          // _requestImage('/archae/skin/img/natsuwithfire.png')
          .then(skinImg => {
            if (live) {
              player.setSkin(skinImg);

              _cancel = () => {
                player.setSkin(null);
              };
            }
          });
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
