window.addEventListener('message', e => {
  const {data} = e;

  if (data._api) {
    const {id, method} = data;

    if (method === 'getItems') {
      const localAssetsString = localStorage.getItem('assets');
      if (localAssetsString) {
        const items = JSON.parse(localAssetsString);

        window.parent.postMessage({
          _response: true,
          id,
          args: {
            items,
          },
        }, '*');
      } else {
        window.parent.postMessage({
          _response: true,
          id,
          args: {
            items,
          },
        }, '*');
      }
    } else if (method === 'setItems') {
      const {args: {items}} = data;
      localStorage.setItem('assets', []);

      window.parent.postMessage({
        _response: true,
        id,
      }, '*');
    }
  }
});
