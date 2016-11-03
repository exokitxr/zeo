const corsPlugin = {
  name: 'corsPlugin',
  version: '0.0.1',
  clientDependencies: {},
  serverDependencies: {
    'react-tools': '',
  },
  client: ({engines: {React, ReactDOM}}) => ({
    mount() {
      const jsx = `\
<div style={{position: 'relative'}}>
  <h1 style={{fontSize: 100, backgroundColor: 'red'}}>Hello, world!</h1>
</div>
`;
      fetch('/corsPlugin', {
        method: 'POST',
        body: jsx,
      }).then(js => {
        if (live) {
          const component = eval(ks);

          const rootEl = window.document.createElement('div');
          window.document.body.appendChild(rootEl);
          ReactDOM.render(component, rootEl);

          this._cleanup = () => {
            ReactDOM.unmountComponentAtNode(rootEl);
          };
        }
      }).catch(err => {
        if (live) {
          console.warn(err);
        }
      });

      let live = true;
      this._cleanup = () => {
        live = false;
      };
    },
    unmount() {
      this._cleanup();
    },
  }),
  server: ({engines: {express}, dependencies: {'react-tools': ReactTools}}) => ({
    mount() {
      function corsPost(req, res) {
        console.log('cors post', req.url);

        let b = '';
        req.setEncoding('utf8');
        req.on('data', s => {
          b += s;
        });
        req.on('end', () => {
          res.type('text/plain');
          res.send(ReactTools.transform());
        });
      }

      express.post('/corsPlugin', corsPost);

      this._cleanup = () => {
        function removeMiddlewares(route, i, routes) {
          if (route.handle.name === 'corsPost') {
            routes.splice(i, 1);
          }
          if (route.route) {
            route.route.stack.forEach(removeMiddlewares);
          }
        }
        express._router.stack.forEach(removeMiddlewares);
      };
    },
    unmount() {
      this._cleanup();
    },
  })
};

archae.addPlugin(corsPlugin, err => {
  console.log('added plugin', err);
});
