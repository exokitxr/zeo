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

        let cwd = '/';
        const _getCwd = () => cwd;
        const _setCwd = c => {
          cwd = c;
        };

        let numUploading = 0;
        const _getUploading = () => numUploading > 0;

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
        const _copy = (src, dst) => fetch('/archae/fs' + src, {
          method: 'COPY',
          headers: {
            'To': dst,
          }
        }).then(res => res.blob().then(() => Promise.resolve()));
        const _move = (src, dst) => fetch('/archae/fs' + src, {
          method: 'MOVE',
          headers: {
            'To': dst,
          }
        }).then(res => res.blob().then(() => Promise.resolve()));
        const _remove = p => fetch('/archae/fs' + p, {
          method: 'DELETE',
        }).then(res => res.blob().then(() => Promise.resolve()));

        const listeners = {
          uploadStart: [],
          uploadEnd: [],
        }
        const _addEventListener = (event, listener) => {
          const eventListeners = listeners[event];
          eventListeners.push(listener);
        };
        const _removeEventListener = (event, listener) => {
          const eventListeners = listeners[event];
          const index = eventListeners.indexOf(listener);
          if (index !== -1) {
            eventListeners.splice(index, 1);
          }
        };
        const _triggerEvent = event => {
          const eventListeners = listeners[event];

          for (let i = 0; i < eventListeners.length; i++) {
            const listener = eventListeners[i];
            listener();
          }
        };

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

            numUploading++;
            if (numUploading === 1) {
              _triggerEvent('uploadStart');
            }

            _setFile(cwd + (!/\/$/.test(cwd) ? '/' : '') + name, file)
              .then(() => {
                console.log('file uploaded', name);

                numUploading--;
                if (numUploading === 0) {
                  _triggerEvent('uploadEnd');
                }
              })
              .catch(err => {
                console.warn(err);

                numUploading--;
                if (numUploading === 0) {
                  _triggerEvent('uploadEnd');
                }
              });
          }
        };
        domElement.addEventListener('drop', drop);
        this._cleanup = () => {
          domElement.removeEventListener('dragover', dragover);
          domElement.removeEventListener('drop', drop);
        };

        return {
          getCwd: _getCwd,
          setCwd: _setCwd,
          getUploading: _getUploading,
          getFile: _getFile,
          getDirectory: _getDirectory,
          setFile: _setFile,
          createDirectory: _createDirectory,
          copy: _copy,
          move: _move,
          remove: _remove,
          addEventListener: _addEventListener,
          removeEventListener: _removeEventListener,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Fs;
