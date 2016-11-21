const ReactDOM = require('react-dom');

class React {
  mount() {
    let rootEl = null;
    this._cleanup = () => {
      if (rootEl) {
        ReactDOM.unmountComponentAtNode(rootEl);
      }
    };

    return {
      render(component) {
        if (!rootEl) {
          rootEl = document.createElement('div');
          document.body.appendChild(rootEl);
        }

        ReactDOM.render(rootEl, component);
      }
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = React;
