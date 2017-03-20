import menuUtils from './lib/utils/menu';

import {
  WIDTH,
  HEIGHT,
  OPEN_WIDTH,
  OPEN_HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
  WORLD_OPEN_WIDTH,
  WORLD_OPEN_HEIGHT,
} from './lib/constants/fs';
import fsRenderer from './lib/render/fs';

const fileFlagSymbol = Symbol();

const SIDES = ['left', 'right'];

const DEFAULT_GRAB_RADIUS = 0.1;
const DEFAULT_FILE_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

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

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/plugins/js-utils',
      '/core/plugins/creature-utils',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      rend,
      jsUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {domElement} = renderer;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const dragover = e => {
          e.preventDefault();
        };
        document.addEventListener('dragover', dragover);
        const drop = e => {
          e.preventDefault();

          const {dataTransfer: {items}} = e;
          if (items.length > 0) {
            const _getFiles = entries => {
              const result = [];

              const _recurseEntries = entries => Promise.all(entries.map(_recurseEntry));
              const _recurseEntry = entry => new Promise((accept, reject) => {
                if (entry.isFile) {
                  entry.file(file => {
                    file.path = entry.fullPath;

                    result.push(file);

                    accept();
                  });
                } else if (entry.isDirectory) {
                  const directoryReader = entry.createReader();
                  directoryReader.readEntries(entries => {
                    _recurseEntries(Array.from(entries))
                      .then(() => {
                        accept();
                      });
                  });
                } else {
                  accept();
                }
              });
              return _recurseEntries(entries)
                .then(() => result);
            };
            const entries = Array.from(items).map(item => item.webkitGetAsEntry());
            _getFiles(entries)
              .then(files => {
                fsApi.emit('upload', files);
              });
          }
        };
        document.addEventListener('drop', drop);

        this._cleanup = () => {
          document.removeEventListener('dragover', dragover);
          document.removeEventListener('drop', drop);
        };

        class FsFile {
          constructor(url) {
            this.url = url;
          }

          read({type = null} = {}) {
            const {url} = this;

            switch (type) {
              case 'image': {
                return new Promise((accept, reject) => {
                  const img = new Image();
                  img.src = url;
                  img.onload = () => {
                    accept(img);
                  };
                  img.onerror = err => {
                    reject(err);
                  };
                });
              }
              case 'audio': {
                return new Promise((accept, reject) => {
                  const audio = document.createElement('audio');
                  audio.src = url;
                  audio.oncanplay = () => {
                    accept(audio);
                  };
                  audio.onerror = err => {
                    reject(err);
                  };
                });
              }
              case 'video': {
                return new Promise((accept, reject) => {
                  const video = document.createElement('video');
                  video.src = url;
                  video.oncanplay = () => {
                    accept(video);
                  };
                  video.onerror = err => {
                    reject(err);
                  };
                });
              }
              case 'model': {
                return fetch(url)
                  .then(res => res.text()
                    .then(modelText => new Promise((accept, reject) => {
                      const loader = new THREEOBJLoader(); // XXX support different model types here

                      const baseUrl = url.match(/^(.*?\/?)[^\/]*$/)[1];
                      loader.setPath('/fs/' + tagMesh.item.id + '/');
                      const modelMesh = loader.parse(modelText);
                      accept(modelMesh);
                    }))
                  );
              }
              default: {
                return fetch(url)
                  .then(res => res.blob());
              }
            }
          }
        }

        class FsApi extends EventEmitter {
          makeFile(url) {
            return new FsFile(url);
          }

          getFileUrl(id, path) {
            if (path) {
              return '/fs/' + id + path;
            } else {
              return '/fs/' + id + '.zip';
            }
          }

          writeFiles(id, files) {
            return Promise.all(files.map(file => {
              const {path} = file;
              const fileUrl = this.getFileUrl(id, path);

              return fetch(fileUrl, {
                method: 'PUT',
                body: file,
              }).then(res => res.blob()
                .then(() => {})
              );
            }));
          }

          dragover(e) {
            dragover(e);
          }

          drop(e) {
            drop(e);
          }
        }

        const fsApi = new FsApi();
        return fsApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _padNumber = (n, width) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};
const _makeId = () => {
  const array = new Uint8Array(128 / 8);
  crypto.getRandomValues(array);
  return array.reduce((acc, i) => {
    return acc + _padNumber(i.toString(16), 2);
  }, '');
};

module.exports = Fs;
