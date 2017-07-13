const path = require('path');
const fs = require('fs');

class Npc {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();
    const {utils: {hash: hashUtils}} = zeo;
    const {murmur} = hashUtils;

    const _readdir = p => new Promise((accept, reject) => {
      fs.readdir(p, (err, files) => {
        if (!err) {
          accept(files);
        } else {
          reject(err);
        }
      });
    });

    return _readdir(path.join(__dirname, 'lib', 'img'))
      .then(files => {
        const npcImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
        function serveNpcImg(req, res, next) {
          // const file = files[Math.floor((murmur(req.url) / 0xFFFFFFFF) * files.length)];
          const file = 'ertsefwe-skin_20170713132536186718.png';
          req.url = path.join('/', file);

          npcImgStatic(req, res, next);
        }
        app.use('/archae/npc/img', serveNpcImg);

        this._cleanup = () => {
          function removeMiddlewares(route, i, routes) {
            if (route.handle.name === 'serveNpcImg') {
              routes.splice(i, 1);
            }
            if (route.route) {
              route.route.stack.forEach(removeMiddlewares);
            }
          }
          app._router.stack.forEach(removeMiddlewares);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Npc;
