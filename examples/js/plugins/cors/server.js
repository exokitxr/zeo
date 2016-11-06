const ReactTools = require('react-tools');

const server = ({engines: {express: app}}) => ({
  mount() {
    function corsPost(req, res) {
      console.log('cors post', req.url);

      let b = '';
      req.setEncoding('utf8');
      req.on('data', s => {
        b += s;
      });
      req.on('end', () => {
        const js = ReactTools.transform(b);

        console.log('cors client transform', {
          req: b,
          res: js,
        });

        res.type('application/javascript');
        res.send(js);
      });
    }

    app.post('/corsPlugin', corsPost);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'corsPost') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    };
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = server;
