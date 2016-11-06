const React = require('react');

const client = ({engines: {react}}) => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return new Promise((accept, reject) => {
      const jsx = `\
<div style={{position: 'relative'}}>
<h1 style={{fontSize: 100, backgroundColor: 'red'}}>Hello, world!</h1>
</div>
`;
      fetch('/corsPlugin', {
        method: 'POST',
        body: jsx,
      }).then(res => {
        if (live) {
          if (res.ok) {
            res.text()
              .then(js => {
                if (live) {
                  const component = eval(js);

                  const rootEl = window.document.createElement('div');
                  window.document.body.appendChild(rootEl);
                  ReactDOM.render(component, rootEl);

                  this._cleanup = () => {
                    ReactDOM.unmountComponentAtNode(rootEl);
                  };

                  accept();
                }
              })
              .catch(err => {
                if (live) {
                  reject(err);
                }
              });
          } else {
            const err = new Error('res failed: ' + res.status);
            reject(err);
          }
        }
      }).catch(err => {
        if (live) {
          reject(err);
        }
      });
    });
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = client;
