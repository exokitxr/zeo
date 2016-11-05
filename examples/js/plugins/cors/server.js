const ReactTools = require('react-tools');

const server = ({engines: {express}}) => ({
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
});

module.exports = server;
