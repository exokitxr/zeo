class Fs {
  constructor(archae) {
    // this._archae = archae;
  }

  mount() {
    // const {_archae: archae} = this;

    const _getFile = p => fetch('/archae/fs' + p).then(res => res.blob());
    const _getDirectory = p => fetch('/archae/fs' + p, {
      headers: {
        'Accept': 'application/json',
      }
    }).then(res => res.json());
    const _setFile = (p, blob) => fetch('/archae/fs' + p, {
      method: 'PUT',
      body: blob,
    }).then(res => res.blob().then(() => Promise.resolve()));
    const _createDirectory = () => fetch('/archae/fs' + p, {
      method: 'POST',
    }).then(res => res.blob().then(() => Promise.resolve()));
    const _remove = () => fetch('/archae/fs' + p, {
      method: 'DELETE',
    }).then(res => res.blob().then(() => Promise.resolve()));

    return {
      getFile: _getFile,
      getDirectory: _getDirectory,
      setFile: _setFile,
      createDirectory: _createDirectory,
      remove: _remove,
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Fs;
