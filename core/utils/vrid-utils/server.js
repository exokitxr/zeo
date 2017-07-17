const vridApiLib = require('vrid/lib/backend-api');

class VridUtils {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {crds: {url: crdsUrl}}} = archae;

    const vridApi = vridApiLib({crdsUrl});

    return {
      vridApi,
    };
  }
}

module.exports = VridUtils;
