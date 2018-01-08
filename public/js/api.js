window.addEventListener('message', e => {
  const {data} = e;

  if (data._api) {
    const {id, method} = data;

    if (method === 'getItems') {
      const localAssetsString = localStorage.getItem('assets');
      if (localAssetsString) {
        const items = JSON.parse(localAssetsString);

        window.parent.postMessage({
          _api: true,
          id,
          type: 'response',
          result: items,
        }, '*');
      } else {
        window.parent.postMessage({
          _api: true,
          id,
          type: 'response',
          result: [],
        }, '*');
      }
    } else if (method === 'setItems') {
      const {args: {assets}} = data;
      localStorage.setItem('assets', JSON.stringify(assets));

      window.parent.postMessage({
        _api: true,
        type: 'response',
        id,
        result: null,
      }, '*');
    }
  }
});

parent.postMessage({
  _api: true,
  type: 'init',
}, '*');
