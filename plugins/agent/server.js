const url = require('url');
const https = require('https');

const wdc = require('watson-developer-cloud');

const config = require('../../../../data/config/config'); // XXX source this from an actual config engine
const {watsonTts, watsonStt} = config;
const ttsConfig = {
  version: 'v1',
  url: 'https://stream.watsonplatform.net/text-to-speech/api',
  username: config.watsonTts.username,
  password: config.watsonTts.password,
};
const ttsService = wdc.authorization(ttsConfig);
const sttConfig = {
  version: 'v1',
  url: 'https://stream.watsonplatform.net/speech-to-text/api',
  username: config.watsonStt.username,
  password: config.watsonStt.password,
};
const sttService = wdc.authorization(sttConfig);

class Agent {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const _requestTtsToken = () => new Promise((accept, reject) => {
      ttsService.getToken({
        url: ttsConfig.url,
      }, (err, token) => {
        if (!err) {
          accept(token);
        } else {
          reject(err);
        }
      });
    });
    const _requestSttToken = () => new Promise((accept, reject) => {
      sttService.getToken({
        url: sttConfig.url,
      }, (err, token) => {
        if (!err) {
          accept(token);
        } else {
          reject(err);
        }
      });
    });
    const _requestTokens = () => Promise.all([
      _requestTtsToken(),
      _requestSttToken(),
    ])
      .then(([
        ttsToken,
        sttToken,
      ]) => ({
        tts: ttsToken,
        stt: sttToken,
      }));

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return _requestTokens()
      .then(tokens => {
        if (live) {
          function serveAgentTokens(req, res, next) {
            res.json({
              tokens,
            });
          }
          app.get('/archae/agent/tokens', serveAgentTokens);

          this._cleanup = () => {
            function removeMiddlewares(route, i, routes) {
              if (route.handle.name === 'serveAgentTokens') {
                routes.splice(i, 1);
              }
              if (route.route) {
                route.route.stack.forEach(removeMiddlewares);
              }
            }
            app._router.stack.forEach(removeMiddlewares);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Agent;
