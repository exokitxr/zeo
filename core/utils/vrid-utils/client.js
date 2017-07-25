class VridUtils {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {crds: {url: crdsUrl}}} = archae;

    const worker = new Worker('archae/plugins/_core_utils_vrid-utils/build/worker.js');
    const queue = [];
    worker.init = crdsUrl => {
      worker.postMessage({
        method: 'init',
        crdsUrl,
      });
    };
    worker.requestCreateDrop = (address, asset, quantity) => new Promise((accept, reject) => {
      worker.postMessage({
        method: 'createDrop',
        address,
        asset,
        quantity,
      });
      queue.push(err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });
    worker.requestCreateGet = (address, asset, quantity) => new Promise((accept, reject) => {
      worker.postMessage({
        method: 'createGet',
        address,
        asset,
        quantity,
      });
      queue.push(err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });
    worker.onmessage = e => {
      queue.shift()(e.data);
    };
    worker.init(crdsUrl);

    return {
      requestCreateDrop: worker.requestCreateDrop,
      requestCreateGet: worker.requestCreateGet,
    };
  }
}

module.exports = VridUtils;
