const url = require('url');
const https = require('https');

class Agent {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    function serveAgentTextToSpeech(req, res, next) {
      let s = '';
      req.setEncoding('utf8');
      req.on('data', d => {
        s += d;
      });
      req.on('end', () => {
        https.get({
          host: 'text-to-speech-demo.mybluemix.net',
          path: '/api/synthesize?text=%3Cvoice-transformation+type%3D%22Custom%22+glottal_tension%3D%22-100%25%22+pitch%3D%22100%25%22+%3E' +
            encodeURIComponent(s.replace(/[^a-z0-9.,;'"()\[\]{}!@#&%^&*\s]+/gi, ' ')) +
            '%3C%2Fvoice-transformation%3E&voice=en-US_AllisonVoice&download=true',
        }, proxyRes => {
          for (const k in proxyRes.headers) {
            if (!/connection|transfer\-encoding|alt\-svc/.test(k)) {
              res.set(k, proxyRes.headers[k]);
            }
          }
          proxyRes.pipe(res);
        }).on('error', err => {
          res.status(500);
          res.send(err.stack);
        });
      });
    }
    app.post('/archae/agent/textToSpeech', serveAgentTextToSpeech);

    function serveAgentSpeechToText(req, res, next) {
      /* const bs = [];
      req.on('data', d => {
        bs.push(d);
      });
      req.on('end', () => {
        const b = Buffer.concat(bs);
      }); */
    }
    app.post('/archae/agent/speechToText', serveAgentSpeechToText);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveAgentTextToSpeech' || route.handle.name === 'serveAgentSpeechToText') {
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

module.exports = Agent;
