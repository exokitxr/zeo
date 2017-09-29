const murmur = require('murmurhash');

// const CHUNK_SIZE = 32 * 1024;

class Fs {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const { _archae: archae } = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae
      .requestPlugins([
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/utils/js-utils',
      ])
      .then(([three, webvr, jsUtils]) => {
        if (live) {
          const { THREE } = three;
          const { events } = jsUtils;
          const { EventEmitter } = events;

          const forwardVector = new THREE.Vector3(0, 0, -1);
          const localVector = new THREE.Vector3();
          const localVector2 = new THREE.Vector3();
          const localVector3 = new THREE.Vector3();

          /* const libRequestPromises = {};
        const _requestLib = libPath => {
          let entry = libRequestPromises[libPath];
          if (!entry) {
            entry = new Promise((accept, reject) => {
              window.module = {};

              const script = document.createElement('script');
              script.src = 'archae/fs/lib/' + libPath;
              script.onload = () => {
                const {exports} = window.module;
                window.module = {};

                document.body.removeChild(script);

                accept(exports);
              };
              script.onerror = err => {
                document.body.removeChild(script);

                reject(err);
              };
              document.body.appendChild(script);
            });
          }
          return entry;
        };
        const _requestNURBSUtils = () => _requestLib('three-extra/NURBSUtils.js')
          .then(NURBSUtils => NURBSUtils(THREE));
        const _requestNURBSCurve = () => Promise.all([
          _requestNURBSUtils(),
          _requestLib('three-extra/NURBSCurve.js'),
        ])
          .then(([
            THREENURBSUtils,
            NURBSCurve,
          ]) => NURBSCurve(THREE, THREENURBSUtils));
        const _requestZlib = () => _requestLib('three-extra/zlib_and_gzip.js');
        const _requestOBJLoader = () => _requestLib('three-extra/OBJLoader.js')
          .then(OBJLoader => OBJLoader(THREE));
        const _requestColladaLoader = () => _requestLib('three-extra/ColladaLoader.js')
          .then(ColladaLoader => ColladaLoader(THREE));
        const _requestFBXLoader = () => Promise.all([
          _requestNURBSCurve(),
          _requestZlib(),
          _requestLib('three-extra/FBXLoader2.js'),
        ])
          .then(([
            THREENURBSCurve,
            Zlib,
            FBXLoader,
          ]) => FBXLoader(THREE, THREENURBSCurve, Zlib));
        const _requestGLTFLoader = () => _requestLib('three-extra/GLTFLoader.js')
          .then(GLTFLoader => GLTFLoader(THREE)); */

          const dragover = e => {
            e.preventDefault();
          };
          document.addEventListener('dragover', dragover);
          const drop = e => {
            e.preventDefault();

            const { dataTransfer: { items } } = e;
            if (items.length > 0) {
              const _getFiles = items => {
                const entries = Array.from(items)
                  .map(item => item.webkitGetAsEntry())
                  .filter(entry => entry !== null);

                const files = [];
                const _recurseEntries = entries =>
                  Promise.all(entries.map(_recurseEntry));
                const _recurseEntry = entry =>
                  new Promise((accept, reject) => {
                    if (entry.isFile) {
                      entry.file(file => {
                        file.path = entry.fullPath;

                        files.push(file);

                        accept();
                      });
                    } else if (entry.isDirectory) {
                      const directoryReader = entry.createReader();
                      directoryReader.readEntries(entries => {
                        _recurseEntries(Array.from(entries)).then(() => {
                          accept();
                        });
                      });
                    } else {
                      accept();
                    }
                  });
                return _recurseEntries(entries).then(() => files);
              };

              _getFiles(items).then(files =>
                Promise.all(
                  files.map((file, i) => {
                    const { type } = file;
                    const remoteFile = fsApi.makeRemoteFile();
                    const dropMatrix = (() => {
                      const { hmd } = webvr.getStatus();
                      const {
                        worldPosition: hmdPosition,
                        worldRotation: hmdRotation,
                        worldScale: hmdScale,
                      } = hmd;
                      const width = 0.2;
                      const fullWidth = (files.length - 1) * width;
                      localVector.copy(hmdPosition).add(
                        localVector2
                          .copy(forwardVector)
                          .multiplyScalar(0.5)
                          .add(
                            localVector3.set(-fullWidth / 2 + i * width, 0, 0)
                          )
                          .applyQuaternion(hmdRotation)
                      );
                      return localVector
                        .toArray()
                        .concat(hmdRotation.toArray())
                        .concat(hmdScale.toArray());
                    })();

                    return remoteFile.write(file).then(() => {
                      fsApi.emit('upload', {
                        file: remoteFile,
                        dropMatrix,
                      });
                    });
                  })
                )
              );
            }
          };
          document.addEventListener('drop', drop);

          this._cleanup = () => {
            document.removeEventListener('dragover', dragover);
            document.removeEventListener('drop', drop);
          };

          /* class FsFile {
          constructor(url) {
            this.url = url;
          }

          read({type = null} = {}) {
            const {url} = this;

            const _validateResponse = res => {
              const {status} = res;

              if (status >= 200 && status < 300) {
                return Promise.resolve(res);
              } else if (status === 404) {
                return Promise.resolve();
              } else {
                return Promise.reject(new Error('invalid response status code: ' + status));
              }
            };

            switch (type) {
              case 'image': {
                return new Promise((accept, reject) => {
                  const img = new Image();
                  img.onload = () => {
                    accept(img);
                  };
                  img.onerror = err => {
                    reject(err);
                  };
                  img.crossOrigin = 'Anonymous';
                  img.src = url;
                });
              }
              case 'audio': {
                return new Promise((accept, reject) => {
                  const audio = document.createElement('audio');
                  audio.oncanplay = () => {
                    accept(audio);
                  };
                  audio.onerror = err => {
                    reject(err);
                  };
                  audio.crossOrigin = 'Anonymous';
                  audio.src = url;
                });
              }
              case 'video': {
                return new Promise((accept, reject) => {
                  const video = document.createElement('video');
                  video.oncanplay = () => {
                    accept(video);
                  };
                  video.onerror = err => {
                    reject(err);
                  };
                  video.crossOrigin = 'Anonymous';
                  video.src = url;
                });
              }
              case 'model': {
                const ext = (() => {
                  const match = url.match(/\.([^\/]*)$/);
                  return match ? match[1].toLowerCase() : '';
                })();

                return fetch(url, {
                  mode: 'cors',
                  credentials: 'include',
                })
                  .then(_validateResponse)
                  .then(res => {
                    if (ext === 'obj' || ext === 'dae') {
                      return res.text();
                    } else if (ext === 'fbx' || ext === 'gltf') {
                      return res.arrayBuffer();
                    } else if (ext === 'json') {
                      return res.json()
                        .catch(err => Promise.resolve(undefined));
                    } else {
                      return Promise.resolve(null);
                    }
                  })
                  .then(modelData =>
                    (() => {
                      switch (ext) {
                        case 'obj':
                          return _requestOBJLoader()
                            .then(THREEOBJLoader => new THREEOBJLoader());
                        case 'dae':
                          return _requestColladaLoader()
                            .then(THREEColladaLoader => new THREEColladaLoader());
                        case 'fbx':
                          return _requestFBXLoader()
                            .then(THREEFBXLoader => new THREEFBXLoader());
                        case 'gltf':
                          return _requestFLTFLoader()
                            .then(THREEGLTFLoader => new THREEGLTFLoader());
                        case 'json':
                          return Promise.resolve(new THREE.ObjectLoader());
                        default:
                          return Promise.resolve(null);
                      }
                    })()
                    .then(loader => new Promise((accept, reject) => {
                      if (loader) {
                        loader.type = ext;
                        loader.crossOrigin = true;
                      }

                      const baseUrl = url.match(/^(.*?\/?)[^\/]*$/)[1];
                      const loaderType = loader ? loader.type : null;
                      if (loaderType === 'obj' || loaderType === 'gltf') {
                        loader.setPath(baseUrl);
                      } else if (loaderType === 'json') {
                        loader.setTexturePath(baseUrl);
                      }

                      if (loaderType === 'obj') {
                        const modelMesh = loader.parse(modelData);
                        accept(modelMesh);
                      } else if (loaderType === 'dae') {
                        loader.parse(modelData, objects => {
                          const {scene} = objects;
                          accept(scene);
                        }, url);
                      } else if (loaderType === 'fbx') {
                        const modelMesh = loader.parse(modelData, baseUrl);
                        accept(modelMesh);
                      } else if (loaderType === 'gltf') {
                        loader.parse(modelData, objects => {
                          const {scene} = objects;
                          accept(scene);
                        });
                      } else if (loaderType === 'json') {
                        if (modelData !== undefined) {
                          loader.parse(modelData, accept);
                        } else {
                          accept(undefined);
                        }
                      } else {
                        const err = new Error('unknown model type: ' + JSON.stringify(ext));
                        reject(err);
                      }
                    }))
                  );
              }
              case 'json': {
                return fetch(url, {
                  mode: 'cors',
                  credentials: 'include',
                })
                  .then(_validateResponse)
                  .then(res => res.json()
                    .catch(err => Promise.resolve())
                  );
              }
              case 'arrayBuffer': {
                return fetch(url, {
                  mode: 'cors',
                  credentials: 'include',
                })
                  .then(_validateResponse)
                  .then(res => res.arrayBuffer());
              }
              default: {
                return fetch(url, {
                  mode: 'cors',
                  credentials: 'include',
                })
                  .then(_validateResponse)
                  .then(res => res.blob());
              }
            }
          }

          write(data) {
            const {url} = this;
            const match = url.match(/^fs\/([^\/]+)(\/.*)$/);

            if (match) {
              const id = match[1];
              const path = match[2];

              return fsApi.writeData(id, path, data);
            } else {
              const err = new Error('cannot write to non-local files');
              reject(err);
            }
          }
        } */

          const _resBlob = res => {
            if (res.status >= 200 && res.status < 300) {
              return res.blob();
            } else if (res.status === 404) {
              return Promise.resolve(null);
            } else {
              return Promise.reject({
                status: res.status,
                stack: 'API returned invalid status code: ' + res.status,
              });
            }
          };

          class RemoteFile {
            constructor(id) {
              this.n =
                id !== undefined
                  ? typeof id === 'number' ? id : murmur(id)
                  : _makeN();
            }

            /* getFileName() {
            return this.id.match(/([^\[\.]*)/)[1];
          } */

            getUrl() {
              return `/archae/fs/hash/${this.n}`;
            }

            read() {
              return fetch(this.getUrl(), {
                credentials: 'include',
              }).then(_resBlob);
            }

            write(d) {
              return fetch(this.getUrl(), {
                method: 'PUT',
                body: d,
                credentials: 'include',
              }).then(_resBlob);
            }

            download() {
              const a = document.createElement('a');
              a.href = this.getUrl();
              a.download = 'file';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
          }

          class FsApi extends EventEmitter {
            makeRemoteFile(id) {
              return new RemoteFile(id);
            }

            /* makeFile(url) {
            return new FsFile(url);
          }

          getFileUrl(id, path) {
            if (path) {
              return 'fs/' + id + path;
            } else {
              return 'fs/' + id;
            }
          }

          getFileMode(mimeType) {
            if (mimeType) {
              if (/^image\/(?:png|jpeg|gif|file)$/.test(mimeType)) {
                return 'image';
              } else if (/^audio\/(?:wav|mp3|mpeg|ogg|vorbis|webm|x-flac)$/.test(mimeType)) {
                return 'audio';
              } else if (/^video\/(?:mp4|webm|ogg)$/.test(mimeType)) {
                return 'video';
              } else if (/^mime\/(?:json|obj|dae|fbx|gltf)$/.test(mimeType)) {
                return 'model';
              } else if (mimeType === 'application/json-world') {
                return 'world';
              } else {
                return null;
              }
            } else {
              return null;
            }
          }

          writeFiles(id, files) {
            return Promise.all(files.map(file => this.writeFile(id, file)));
          }

          writeFile(id, file) {
            const {path} = file;
            const fileUrl = this.getFileUrl(id, path);

            return fetch(fileUrl, {
              method: 'PUT',
              body: file,
              credentials: 'include',
            }).then(res => res.blob()
              .then(() => {})
            );
          }

          writeData(id, path, data) {
            return new Promise((accept, reject) => {
              const fileUrl = this.getFileUrl(id, path);

              const _recurse = start => {
                if (start < data.length) {
                  const end = start + CHUNK_SIZE;
                  const slice = data.slice(start, end);

                  const headers = new Headers();
                  headers.append('range', 'bytes=' + start + '-');

                  return fetch(fileUrl, {
                    method: 'PUT',
                    headers: headers,
                    body: slice,
                    credentials: 'include',
                  }).then(res => {
                    _recurse(end);
                  })
                  .catch(reject);
                } else {
                  accept();
                }
              };
              _recurse(0);
            });
          } */

            dragover(e) {
              dragover(e);
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
const _makeN = (() => {
  const array = new Uint32Array(1);
  return () => {
    crypto.getRandomValues(array);
    return array[0];
  };
})();
/* const _makeId = () => Math.random().toString(36).substring(7);
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
}; */

module.exports = Fs;
