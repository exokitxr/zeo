const React = require('react');
const ReactDOM = require('react-dom');

const client = ({engines: {react}}) => ({
  mount() {
    console.log('mounting cors client');

    let live = true;
    this._cleanup = () => {
      live = false;
    };

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

                const rootEl = document.createElement('div');
                document.body.appendChild(rootEl);
                ReactDOM.render(component, rootEl);

                this._cleanup = () => {
                  ReactDOM.unmountComponentAtNode(rootEl);
                };

                console.log('cors plugin done');
              }
            })
            .catch(err => {
              if (live) {
                console.warn(err);
              }
            });
        } else {
          const err = new Error('res failed: ' + res.status);
          console.warn(err);
        }
      }
    }).catch(err => {
      if (live) {
        console.warn(err);
      }
    });
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = client;
