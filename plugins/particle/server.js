const path = require('path');
const fs = require('fs');

const txtr = require('txtr');
const {
  TEXTURE_SIZE,
} = require('./lib/constants/constants');

const TEXTURES = [
  'explosion',
  'smoke',
  'rain',
];

class Particle {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, ws, app, wss} = archae.getCore();
    const {three, elements, utils: {js: jsUtils, hash: hashUtils, random: randomUtils, image: imageUtils}} = zeo;
    const {THREE} = three;
    const {murmur} = hashUtils;
    const {jimp} = imageUtils;

    const textureImg = new jimp(TEXTURE_SIZE, TEXTURE_SIZE);
    const textureAtlas = txtr(TEXTURE_SIZE, TEXTURE_SIZE);
    const textureUvs = {};

    const _registerTexture = (src, name, {fourTap = false} = {}) => jimp.read(src)
      .then(img => {
        const n = murmur(name);

        if (!textureUvs[n]) {
          if (fourTap) {
            const srcImg = img;
            img = new jimp(srcImg.bitmap.width * 2, srcImg.bitmap.height * 2);
            img.composite(srcImg, 0, 0);
            img.composite(srcImg, srcImg.bitmap.width, 0);
            img.composite(srcImg, 0, srcImg.bitmap.height);
            img.composite(srcImg, srcImg.bitmap.width, srcImg.bitmap.height);
          }
          const rect = textureAtlas.pack(img.bitmap.width, img.bitmap.height);
          const uv = textureAtlas.uv(rect);

          textureImg.composite(img, rect.x, rect.y);
          textureImg.version++;

          textureUvs[n] = uv;
        }
      });
    const _registerTextures = () => Promise.all(TEXTURES.map(texture => _registerTexture(path.join(__dirname, 'lib', 'img', texture + '.png'), texture)))
      .then(() => {});

    return _registerTextures()
      .then(() => {
        function serveParticleTextureAtlas(req, res, next) {
          textureImg.getBuffer('image/png', (err, buffer) => {
            if (!err) {
              res.type('image/png');
              res.end(buffer);
            } else {
              res.status(500);
              res.json({
                error: err.stack,
              });
            }
          });
        }
        app.get('/archae/particle/texture-atlas.png', serveParticleTextureAtlas);

        function serveParticleTextureUvs(req, res, next) {
          res.json(textureUvs);
        }
        app.get('/archae/particle/texture-uvs.json', serveParticleTextureUvs);

        this._cleanup = () => {
          function removeMiddlewares(route, i, routes) {
            if (
              route.handle.name === 'serveParticleTextureAtlas' ||
              route.handle.name === 'serveParticleTextureUvs'
            ) {
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

module.exports = Particle;
