const path = require('path');

const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();

class Biolumi {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const workerStatic = express.static(path.join(__dirname));
    function serveWorker(req, res, next) {
      workerStatic(req, res, next);
    }
    app.use('/archae/biolumi', serveWorker);

    let signalReq = null;
    let queue1 = null;
    let queue2 = null;
    app.post('/archae/signal/1', bodyParserJson, (req, res, next) => {
      if (queue1) {
        queue1({error: 'kicked'});
        queue1 = null;
      }
      queue1 = (err, signalRes) => {
        if (!err) {
          res.json(signalRes);
        } else {
          res.status(500);
          res.json(err);
        }

        clearTimeout(timeout);
      };
      const timeout = setTimeout(() => {
        queue1({error: 'timed out'});
        queue1 = null;
      }, 10 * 1000);

      if (queue2) {
        queue2(null, req.body);
        queue2 = null;
      } else {
        signalReq = req.body;
      }
    });
    app.get('/archae/signal/2', (req, res, next) => {
      if (signalReq) {
        res.json(signalReq);

        signalReq = null;
      } else {
        if (queue2) {
          queue2({error: 'kicked'});
          queue2 = null;
        }
        queue2 = (err, signalReq) => {
          if (!err) {
            res.json(signalReq);
          } else {
            res.status(500);
            res.json(err);
          }

          clearTimeout(timeout);
        };
        const timeout = setTimeout(() => {
          queue2({error: 'timed out'});
          queue2 = null;
        }, 10 * 1000);
      }
    });
    app.post('/archae/signal/3', bodyParserJson, (req, res, next) => {
      if (queue1) {
        queue1(null, req.body);
        queue1 = null;

        res.json({ok: true});
      } else {
        res.status(500);
        res.json({error: 'no remote'});
      }
    });

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'serveWorker'
        ) {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Biolumi;
