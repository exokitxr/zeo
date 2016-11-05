const client = {
  mount: ({dependencies: {'react': React, 'react-dom': ReactDOM}}) => {
    let rootEl = null;

    this._cleanup = () => {
      if (rootEl) {
        ReactDOM.unmountComponentAtNode(rootEl);
      }
    };

    return Promise.accept({
      render(component) {
        if (!rootEl) {
          rootEl = document.createElement('div');
          document.body.appendChild(rootEl);
        }

        ReactDOM.render(rootEl, component);
      }
    });
  },
  unmount: () => {
    this._cleanup();
  },
};

module.exports = client;
