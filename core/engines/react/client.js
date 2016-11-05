const client = {
  mount: ({dependencies: {'react': React, 'react-dom': ReactDOM}}) => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const fakeElement = React.createElement('div');

    ReactDOM.render(rootEl, fakeElement);

    this._cleanup = () => {
      ReactDOM.unmountComponentAtNode(rootEl);
    };
  },
  unmount: () => {
    this._cleanup();
  },
};

module.exports = client;
