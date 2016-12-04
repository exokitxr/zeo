self.onmessage = e => {
  const {data} = e;
  const {method} = data;

  if (method === 'init') {
    const {args} = data;
    const [type, module, target] = args;

    self.onmessage = null;

    importScripts([
      '/archae/archae.js',
      '/archae/' + type + '/' + module + '/' + target + '.js',
    ]);
  } else {
    console.warn('unknown method: ' + method);

    self.close();
  }
};
