self.module = {};

const vridApiLib = require('vrid/lib/frontend-api');
let vridApi = null;

self.onmessage = e => {
  const {data} = e;
  const {method} = data;

  if (method === 'init') {
    const {crdsUrl} = data;
    vridApi = vridApiLib({crdsUrl});
  } else if (method === 'createDrop') {
    const {address, asset, quantity} = data;
    vridApi.requestCreateDrop(address, asset, quantity)
      .then(() => {
        postMessage(null);
      })
      .catch(err => {
        postMessage({error: err.stack});
      });
  } else if (method === 'createGet') {
    const {address, asset, quantity} = data;
    vridApi.requestCreateGet(address, asset, quantity)
      .then(() => {
        postMessage(null);
      })
      .catch(err => {
        postMessage({error: err.stack});
      });
  } else {
    console.warn('vrid worker unknown method:', JSON.stringify(method));
  }
};
