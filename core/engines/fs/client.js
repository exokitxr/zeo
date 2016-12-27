class Fs {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/three',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {renderer} = three;
        const {domElement} = renderer;

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
        const _createDirectory = p => fetch('/archae/fs' + p, {
          method: 'POST',
        }).then(res => res.blob().then(() => Promise.resolve()));
        const _remove = p => fetch('/archae/fs' + p, {
          method: 'DELETE',
        }).then(res => res.blob().then(() => Promise.resolve()));

        const dragover = e => {
          e.preventDefault();
        };
        domElement.addEventListener('dragover', dragover);
        const drop = e => {
          e.preventDefault();

          const {dataTransfer: {files}} = e;
          if (files.length > 0) {
            const file = files[0];
            const {name} = file;
            _setFile('/' + name, file)
              .then(() => {
                console.log('file uploaded', name);
              })
              .catch(err => {
                console.warn(err);
              });
          }
        };
        domElement.addEventListener('drop', drop);
        this._cleanup = () => {
          domElement.removeEventListener('dragover', dragover);
          domElement.removeEventListener('drop', drop);
        };

        return {
          getFile: _getFile,
          getDirectory: _getDirectory,
          setFile: _setFile,
          createDirectory: _createDirectory,
          remove: _remove,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Fs;
