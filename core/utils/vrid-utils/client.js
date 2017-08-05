class VridUtils {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        vrid: {
          url: vridUrl,
        },
      },
    } = archae;

    const _resJson = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.json();
      } else {
        return Promise.reject({
          status: res.status,
          stack: 'API returned invalid status code: ' + res.status,
        });
      }
    };

    const _requestCreateGet = (address, asset, quantity) => fetch(`${vridUrl}/id/api/get`, {
      method: 'POST',
      headers: (() => {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        return headers;
      })(),
      body: JSON.stringify({
        address,
        asset,
        quantity,
      }),
      credentials: 'include',
    })
      .then(_resJson);
    const _requestCreateDrop = (address, asset, quantity) => fetch(`${vridUrl}/id/api/drop`, {
      method: 'POST',
      headers: (() => {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        return headers;
      })(),
      body: JSON.stringify({
        address,
        asset,
        quantity,
      }),
      credentials: 'include',
    })
      .then(_resJson);

    return {
      requestCreateGet: _requestCreateGet,
      requestCreateDrop: _requestCreateDrop,
    };
  }
}

module.exports = VridUtils;
