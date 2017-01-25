class Hub {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {hub: {url: hubUrl}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestLogin = () => {
      const tokenString = getQueryParameterByName('token') || localStorage.getItem('token') || null;

      if (typeof tokenString === 'string') {
        const token = _parseJson(tokenString);

        return fetch(hubUrl + '/login', {
          method: 'POST',
          body: JSON.stringify({
            token,
          }),
        }).then(res => res.json());
      } else {
        return Promise.resolve();
      }
    };

    return _requestLogin()
      .then(j => {
        console.log('got login result', j); // XXX

        const username = j ? j.username : null;
        const matrix = j ? j.matrix : null;
        const plan = j ? j.plan : null;

        const _getUser = () => ({
          username,
          matrix,
          plan,
        });

        return {
          getUser: _getUser,
        };
      })
      .catch(err => {
        console.warn(err);
      });
  }

  unmount() {
    this._cleanup();
  }
}

const getQueryParameterByName = name => {
  name = name.replace(/[\[\]]/g, "\\$&");

  const url = window.location.href;
  const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
  const results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
};

const _parseJson = s => {
  let err = null;
  let result;
  try {
    j = JSON.parse(s);
  } catch (e) {
    err = e;
  }
  if (!err) {
    return j;
  } else {
    return null;
  }
};

module.exports = Hub;
