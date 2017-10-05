const strg = require('strg');

const STRG_HASH = '8357f3144f67fca6d1d10f3a2a2f057666bc7815';

module.exports = {
  mount() {
    return {
      strgApi: strg(`https://cdn.rawgit.com/modulesio/strg/${STRG_HASH}/iframe.html`),
    };
  },
  unmount() {},
};
