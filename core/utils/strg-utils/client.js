const strg = require('strg');

const STRG_HASH = '0f08b1d486c793efeeb2b0d7fc8a36efa3d9b864';

module.exports = {
  mount() {
    return {
      strgApi: strg(`https://cdn.rawgit.com/modulesio/strg/${STRG_HASH}/iframe.html`),
    };
  },
  unmount() {},
};
