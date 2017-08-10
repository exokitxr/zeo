import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  TAGS_WIDTH,
  TAGS_HEIGHT,
  TAGS_WORLD_WIDTH,
  TAGS_WORLD_HEIGHT,
  TAGS_WORLD_DEPTH,
} from './lib/constants/file';
import fileRender from './lib/render/file';
import svgize from 'svgize';

class FileEngine {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, server: {url: serverUrl, enabled: serverEnabled}}} = archae;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/resource',
      '/core/engines/rend',
      '/core/engines/tags',
      // '/core/engines/fs',
      '/core/engines/world',
      '/core/engines/keyboard',
      '/core/utils/creature-utils',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      resource,
      rend,
      tags,
      // fs,
      world,
      keyboard,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE} = three;
        const {sfx} = resource;

        const fileRenderer = fileRender.makeRenderer({creatureUtils});

        const transparentImg = biolumi.getTransparentImg();
        const blackImg = biolumi.getBlackImg();
        const transparentMaterial = biolumi.getTransparentMaterial();

        /* const _decorateFile = item => {
          const {id, name, mimeType, instancing, paused, value} = item;
          const mode = fs.getFileMode(mimeType);
          const media = null;
          const preview = null;

          return {
            id,
            name,
            mimeType,
            instancing,
            paused,
            value,
            mode,
            media,
            preview,
          };
        };
        const _previewFile = file => {
          const {mode} = file;

          if (mode === 'image') {
            const {id, name} = file;
            const result = fs.makeFile('fs/' + id + name)
              .read({type: 'image'})
              .then(img => {
                if (live) {
                  const imageData = _resizeImage(img, 50, 50);
                  const svgString = svgize.imageDataToSvg(imageData, {
                    style: 'width: 50px; height: 50px; margin: 10px;',
                  });
                  file.media = img;
                  file.preview = svgString;
                }
              });

            let live = true;
            result.cancel = () => {
              live = false;
            };

            return result;
          } else if (mode === 'audio') {
            const {id, name} = file;
            const result = fs.makeFile('fs/' + id + name)
              .read({type: 'audio'})
              .then(audio => {
                if (live) {
                  file.media = audio;

                  let interval = null;
                  audio.addEventListener('play', () => {
                    interval = setInterval(() => {
                      npmState.value = audio.currentTime / audio.duration;

                      _updatePages();
                    }, 100);
                  });
                  audio.addEventListener('pause', () => {
                    clearInterval(interval);
                    interval = null;
                  });
                }
              });

            let live = true;
            result.cancel = () => {
              live = false;
            };

            return result;
          } else if (mode === 'video') {
            const {id, name} = file;
            const result = fs.makeFile('fs/' + id + name)
              .read({type: 'video'})
              .then(video => {
                if (live) {
                  file.media = video;

                  const _update = () => {
                    const {detailsMesh} = fileMesh;
                    detailsMesh.material.map.needsUpdate = true;
                  };
                  let interval = null;
                  video.addEventListener('play', () => {
                    rend.on('update', _update);

                    interval = setInterval(() => {
                      npmState.value = video.currentTime / video.duration;

                      _updatePages();
                    }, 100);
                  });
                  video.addEventListener('pause', () => {
                    rend.removeListener('update', _update);

                    clearInterval(interval);
                    interval = null;
                  });
                }
              });

            let live = true;
            result.cancel = () => {
              live = false;
            };

            return result;
          } else if (mode === 'world') {
            const {id, name} = file;
            const result = fs.makeFile('fs/' + id + name)
              .read({type: 'json'})
              .then(world => {
                if (live) {
                  file.media = world;
                  file.preview = world;
                }
              });

            let live = true;
            result.cancel = () => {
              live = false;
            };

            return result;
          } else {
            return Promise.resolve();
          }
        }; */

        const updatePromises = [];
        const _cancelNpm = () => {
          if (updatePromises.length > 0) {
            for (let i = 0; i < updatePromises.length; i++) {
              const updatePromise = updatePromises[i];
              updatePromise.cancel();
            }
            updatePromises.length = 0;
          }
        };
        const _updateNpm = () => {
          _cancelNpm();

          /* const {inputText} = npmState;

          const files = tags.getTagMeshes()
            .filter(({item}) =>
              item.type === 'file' &&
              item.name.indexOf(inputText) !== -1
            )
            .map(({item}) => _decorateFile(item));

          if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const promise = _previewFile(file);
              updatePromises.push(promise);
            }

            Promise.all(updatePromises)
              .then(() => {
                updatePromises.length = 0;
                _updatePages();
              })
              .catch(err => {
                console.warn(err);

                updatePromises.length = 0;
                _updatePages();
              });
          } */

          npmState.loading = false;
          npmState.page = 0;
          npmState.tagSpecs = files;
          npmState.numTags = files.length;

          npmState.loading = false;
        };

        const npmState = {
          loading: true,
          inputText: '',
          tagSpecs: [],
          numTags: 0,
          file: null,
          value: 0,
          page: 0,
        };
        const focusState = {
          keyboardFocusState: null,
        };
        const npmCacheState = {
          loaded: false,
        };

        const fileMesh = (() => {
          const object = new THREE.Object3D();
          object.visible = false;

          const planeMesh = (() => {
            const worldUi = biolumi.makeUi({
              width: WIDTH,
              height: HEIGHT,
            });
            const mesh = worldUi.makePage(({
              npm: {
                loading,
                inputText,
                tagSpecs,
                numTags,
                file,
                value,
                page,
              },
              focus: {
                keyboardFocusState,
              },
            }) => {
              const {type = '', inputValue = 0} = keyboardFocusState || {};
              const focus = type === 'file:search';

              return {
                type: 'html',
                src: fileRenderer.getFilePageSrc({
                  loading,
                  inputText,
                  inputValue,
                  tagSpecs,
                  numTags,
                  file,
                  value,
                  page,
                  focus,
                }),
                x: 0,
                y: 0,
                w: WIDTH,
                h: HEIGHT,
              };
            }, {
              type: 'file',
              state: {
                npm: npmState,
                focus: focusState,
              },
              worldWidth: WORLD_WIDTH,
              worldHeight: WORLD_HEIGHT,
              isEnabled: () => rend.isOpen(),
            });
            mesh.receiveShadow = true;

            const {page} = mesh;
            rend.addPage(page);

            cleanups.push(() => {
              rend.removePage(page);
            });

            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          const size = 480;
          const worldWidth = (size / WIDTH) * WORLD_WIDTH;
          const worldHeight = (size / HEIGHT) * WORLD_HEIGHT;
          const detailsMesh = (() => {
            const geometry = new THREE.PlaneBufferGeometry(worldWidth, worldHeight);
            const texture = new THREE.Texture(
              transparentImg,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.NearestFilter,
              THREE.NearestFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              16
            );
            texture.needsUpdate = true;
            const material = new THREE.MeshBasicMaterial({
              color: 0xFFFFFF,
              map: texture,
              side: THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
              -(WORLD_WIDTH / 2) + (worldWidth / 2) + ((30 / WIDTH) * WORLD_WIDTH),
              (WORLD_HEIGHT / 2) - (worldHeight / 2) - (((30 + 80) / HEIGHT) * WORLD_HEIGHT),
              0.001
            );
            mesh.visible = false;
            mesh.setAspectRatio = aspectRatio => {
              mesh.scale.x = aspectRatio < 1 ? aspectRatio : 1;
              mesh.scale.y = aspectRatio > 1 ? (1 / aspectRatio) : 1;
              mesh.updateMatrixWorld();
            };

            return mesh;
          })();
          object.add(detailsMesh);
          object.detailsMesh = detailsMesh;

          const anchors = [
            {
              rect: {
                left: 0,
                right: size,
                top: 0,
                bottom: size,
              },
              onclick: 'file:media',
            },
          ];
          const detailsPage = biolumi.makePage(null, {
            type: 'file:media',
            width: size,
            height: size,
            worldWidth: worldWidth,
            worldHeight: worldHeight,
            color: [1, 1, 1, 0],
            layer: {
              getAnchors: () => anchors,
            },
          });
          detailsPage.mesh.position.copy(detailsMesh.position);
          detailsPage.mesh.visible = false;
          detailsPage.setId = id => {
            anchors[0].onclick = id ? ('file:media:' + id) : 'file:media';
          };
          object.add(detailsPage.mesh);
          object.detailsPage = detailsPage;
          rend.addPage(detailsPage);

          cleanups.push(() => {
            rend.removePage(detailsPage);
          });

          return object;
        })();
        rend.registerMenuMesh('fileMesh', fileMesh);
        fileMesh.updateMatrixWorld();

        const _updatePages = () => {
          const {planeMesh} = fileMesh;
          const {page} = planeMesh;
          return page.update();
        };
        _updatePages();

        const _tabchange = tab => {
          if (tab === 'file') {
            keyboard.tryBlur();

            const {loaded} = npmCacheState;
            if (!loaded) {
              _updateNpm();
              _updatePages();

              npmCacheState.loaded = true;
            }
          }
        };
        rend.on('tabchange', _tabchange);

        const _trigger = e => {
          const {side} = e;

          const _clickMenu = () => {
            const hoverState = rend.getHoverState(side);
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            let match;
            if (onclick === 'file:focus') {
              const {inputText} = npmState;
              const {value, target: page} = hoverState;
              const {layer: {measures}} = page;
              const valuePx = value * (WIDTH - (250 + (30 * 2)));
              const {index, px} = biolumi.getTextPropertiesFromCoord(measures['file:search'], inputText, valuePx);
              const {hmd: hmdStatus} = webvr.getStatus();
              const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
              const keyboardFocusState = keyboard.focus({
                type: 'file:search',
                position: hmdPosition,
                rotation: hmdRotation,
                inputText: inputText,
                inputIndex: index,
                inputValue: px,
                page: page,
              });
              focusState.keyboardFocusState = keyboardFocusState;

              keyboardFocusState.on('update', () => {
                const {inputText: keyboardInputText} = keyboardFocusState;
                const {inputText: npmInputText} = npmState;

                if (keyboardInputText !== npmInputText) {
                  npmState.inputText = keyboardInputText;

                  _updateNpm();
                }

                _updatePages();
              });
              keyboardFocusState.on('blur', () => {
                focusState.keyboardFocusState = null;

                _updatePages();
              });

              _updatePages();

              return true;
            } else if (match = onclick.match(/^file:(up|down)$/)) {
              const direction = match[1];

              npmState.page += (direction === 'up' ? -1 : 1);

              _updatePages();

              return true;
            } else if (match = onclick.match(/^file:file:(.+)$/)) {
              const id = match[1];

              const itemSpec = npmState.tagSpecs.find(tagSpec => tagSpec.id === id);
              _setFile(itemSpec);

              return true;
            } else if (onclick === 'file:back') {
              _setFile(null);

              return true;
            } else if (match = onclick.match(/^file:media:(.+)$/)) {
              const id = match[1];

              const itemSpec = npmState.tagSpecs.find(tagSpec => tagSpec.id === id);
              const {media} = itemSpec;

              if (media && (media.tagName === 'AUDIO' || media.tagName === 'VIDEO')) {
                if (media.paused) {
                  media.play();
                } else {
                  media.pause();
                }
              }

              return true;
            } else if (match = onclick.match(/^file:seek:(.+)$/)) {
              const id = match[1];

              const itemSpec = npmState.tagSpecs.find(tagSpec => tagSpec.id === id);
              const {media} = itemSpec;

              if (media && (media.tagName === 'AUDIO' || media.tagName === 'VIDEO')) {
                const {value} = hoverState;
                media.currentTime = value * media.duration;

                npmState.value = value;

                _updatePages();
              }

              return true;
            } else if (match = onclick.match(/^file:remove:(.+)$/)) {
              const id = match[1];

              world.removeTag(id);

              npmState.tagSpecs.splice(npmState.tagSpecs.findIndex(tagSpec => tagSpec.id === id), 1);
              _setFile(null);

              return true;
            /* } else if (match = onclick.match(/^file:loadEntities:(.+)$/)) {
              const id = match[1];

              const file = npmState.tagSpecs.find(tagSpec => tagSpec.id === id);
              const {name} = file;
              fs.makeFile('fs/' + id + name)
                .read({type: 'json'})
                .then(j => {
                  const {entities} = j;

                  for (let i = 0; i < entities.length; i++) { // need to do this so new entities do not conflict with current ones
                    const entity = entities[i];
                    entity.id = _makeId();
                  }

                  rend.loadEntities(entities);
                })
                .catch(err => {
                  console.warn(err);
                });

              return true;
            } else if (match = onclick.match(/^file:replaceWorld:(.+)$/)) {
              const id = match[1];

              const file = npmState.tagSpecs.find(tagSpec => tagSpec.id === id);
              const {name} = file;
              fs.makeFile('fs/' + id + name)
                .read({type: 'json'})
                .then(j => {
                  const {entities} = j;

                  for (let i = 0; i < entities.length; i++) { // need to do this so new entities do not conflict with current ones
                    const entity = entities[i];
                    entity.id = _makeId();
                  }

                  rend.clearAllEntities();
                  rend.loadEntities(entities);
                })
                .catch(err => {
                  console.warn(err);
                });

              return true; */
            } else {
              return false;
            }
          };
          const _clickMenuBackground = () => {
            const hoverState = rend.getHoverState(side);
            const {target} = hoverState;

            if (target && target.mesh && target.mesh.parent === fileMesh) {
              return true;
            } else {
              return false;
            }
          };

          if (_clickMenu()) {
            sfx.digi_select.trigger();

            e.stopImmediatePropagation();
          } else if (_clickMenuBackground()) {
            sfx.digi_plink.trigger();

            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger);

        cleanups.push(() => {
          rend.removeListener('tabchange', _tabchange);
          input.removeListener('trigger', _trigger);
        });

        /* const _setFile = itemSpec => {
          if (itemSpec) {
            npmState.file = itemSpec;

            const {detailsMesh, detailsPage} = fileMesh;
            const {media} = itemSpec;
            if (media && media.tagName === 'IMG') {
              detailsMesh.material.map.image = media;
              detailsMesh.material.map.needsUpdate = true;
              detailsMesh.setAspectRatio(media.width / media.height);
            } else if (media && media.tagName === 'AUDIO') {
              detailsMesh.material.map.image = blackImg;
              detailsMesh.material.map.needsUpdate = true;

              npmState.value = media.currentTime / media.duration;
            } else if (media && media.tagName === 'VIDEO') {
              detailsMesh.material.map.image = media;
              detailsMesh.material.map.needsUpdate = true;

              npmState.value = media.currentTime / media.duration;
            } else {
              detailsMesh.material.map.image = blackImg;
              detailsMesh.material.map.needsUpdate = true;
            }
            const {id} = itemSpec;
            detailsPage.setId(id);

            _updatePages()
              .then(() => {
                if (media && (media.tagName === 'IMG' || media.tagName === 'AUDIO' || media.tagName === 'VIDEO')) {
                  detailsMesh.visible = true;
                  detailsPage.mesh.visible = true;
                } else {
                  detailsMesh.visible = false;
                  detailsPage.mesh.visible = false;
                }
              });
          } else {
            const {file: oldFile} = npmState;
            npmState.file = null;

            _updatePages()
              .then(() => {
                const {detailsMesh} = fileMesh;

                if (detailsMesh.visible) {
                  detailsMesh.visible = false;

                  const {detailsPage} = fileMesh;
                  detailsPage.mesh.visible = false;

                  const {media} = oldFile;
                  if (media && (media.tagName === 'AUDIO' || media.tagName === 'VIDEO') && !media.paused) {
                    media.pause();
                  }
                }
              });
          }
        };
        const _addFile = item => {
          const fileItem = _decorateFile(item);
          _previewFile(fileItem)
            .then(() => {
              _updatePages();
            })
            .catch(err => {
              console.warn(err);

              _updatePages();
            });
          npmState.tagSpecs.push(fileItem);
          _setFile(fileItem);
        }; */

        return {
          // addFile: _addFile,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}
const _makeId = () => Math.random().toString(36).substring(7);
const _resizeImage = (img, width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return imageData;
};

module.exports = FileEngine;
