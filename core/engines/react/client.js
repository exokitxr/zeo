const ReactDOM = require('react-dom');

const client = {
  mount() {
    let rootEl = null;

    this._cleanup = () => {
      if (rootEl) {
        ReactDOM.unmountComponentAtNode(rootEl);
      }
    };

    return Promise.resolve({
      render(component) {
        if (!rootEl) {
          rootEl = document.createElement('div');
          document.body.appendChild(rootEl);
        }

        ReactDOM.render(rootEl, component);
      }
    });
  },
  unmount() {
    this._cleanup();
  },
};

module.exports = client;
