const SIDES = ['left', 'right'];

class Skin {
  mount() {
    const {three, pose, render, player, utils: {skin: skinUtils}} = zeo;
    const {THREE, scene, camera, renderer} = three;
    const {skin} = skinUtils;

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

    return _requestImage('/archae/skin/img/darkvortexity.png')
    // return _requestImage('/archae/skin/img/groot.png')
    // return _requestImage('/archae/skin/img/natsuwithfire.png')
      .then(skinImg => {
        if (live) {
          player.setSkin(skinImg);

          this._cleanup = () => {
            player.setSkin(null);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Skin;
