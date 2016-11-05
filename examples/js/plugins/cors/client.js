const React = require('react');

const client = ({engines: {react}}) => ({
  mount() {
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
              }
            })
            .catch(err => {
              console.warn(err);
            });
        } else {
          console.warn('res failed', res);
        }
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
});

module.exports = client;
