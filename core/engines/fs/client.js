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

        /* class FsFile {
          constructor(id, name, mimeType, matrix) {
            this.id = id;
            this.name = name;
            this.mimeType = mimeType;
            this.matrix = matrix;

            this.instancing = false;

            this.open = false;
          }
        } */

        class FsApi extends EventEmitter {
          getFileUrl(id, path) {
            return '/archae/fs/' + id + path;
          }

          readFile(id, path) {
            const fileUrl = this.getFileUrl(id, path);

            return fetch(fileUrl)
              .then(res => res.blob());
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
