self.onmessage = e => {
  const {data} = e;
  const {method} = data;

  if (method === 'init') {
    const {args} = data;
    const [type, module, target] = args;

    self.onmessage = e => {
      const {data} = e;
      const {method, args, id} = data;

      const cb = (error = null, result = null, transfers) => {
        self.postMessage({
          id,
          error,
          result,
        }, transfers);
      };

      if (self.onrequest) {
        self.onrequest(method, args, cb);
      } else {
        const err = new Error('no request handler registered');
        cb(err);
      }
    };

    self.module = {}; // for proper loading of worker builds

    importScripts(
      '/archae/archae.js',
      '/archae/' + type + '/' + module + '/' + target + '.js'
    );
  } else {
    console.warn('unknown method: ' + method);

    self.close();
  }
};
