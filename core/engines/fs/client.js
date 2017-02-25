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
      '/core/engines/hands',
      '/core/plugins/js-utils',
      '/core/plugins/creature-utils',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      rend,
      hands,
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
        domElement.addEventListener('dragover', dragover);
        const drop = e => {
          e.preventDefault();

          const {dataTransfer: {files}} = e;
          if (files.length > 0) {
            const file = files[0];

            fsApi.emit('upload', file);
          }
        };
        domElement.addEventListener('drop', drop);

        this._cleanup = () => {
          domElement.removeEventListener('dragover', dragover);
          domElement.removeEventListener('drop', drop);
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
          getFileUrl(id) {
            return '/archae/fs/' + id;
          }

          readFile(id) {
            const fileUrl = this.getFileUrl(id);

            return fetch(fileUrl)
              .then(res => res.blob());
          }

          writeFile(id, blob) {
            const fileUrl = this.getFileUrl(id);

            return fetch(fileUrl, {
              method: 'PUT',
              body: blob,
            }).then(res => res.blob()
              .then(() => {})
            );
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
