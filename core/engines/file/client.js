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
      '/core/engines/rend',
      '/core/engines/tags',
      '/core/engines/fs',
      '/core/engines/keyboard',
      '/core/engines/color',
      '/core/utils/creature-utils',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      rend,
      tags,
      fs,
      keyboard,
      color,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE} = three;

        const fileRenderer = fileRender.makeRenderer({creatureUtils});

        const transparentMaterial = biolumi.getTransparentMaterial();

        const mainFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 36,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };
        const subcontentFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 24,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };

        const zeroQuaternion = new THREE.Quaternion();
        const forwardVector = new THREE.Vector3(0, 0, -1);

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const _updateNpm = () => {
          const {inputText} = npmState;

          const itemSpecs = tags.getTagMeshes()
            .filter(({item}) =>
              item.type === 'file' &&
              !(item.metadata && item.metadata.isStatic) &&
              item.name.indexOf(inputText) !== -1
            )
            .map(({item}) => {
              const {name, mimeType, instancing, paused, value} = item;
              const mode = fs.getFileMode(mimeType);
              return {name, mimeType, instancing, paused, value, mode};
            });

          npmState.loading = false;
          npmState.page = 0;
          npmState.tagSpecs = itemSpecs;
          npmState.numTags = itemSpecs.length;

          npmState.loading = false;

          _updatePages();
        };

        const npmState = {
          loading: true,
          inputText: '',
          tagSpecs: [],
          numTags: 0,
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
                page,
              },
              focus: {
                keyboardFocusState,
              },
            }) => {
              const {type = '', inputValue = 0} = keyboardFocusState || {};
              const focus = type === 'file';

              return {
                type: 'html',
                src: fileRenderer.getFilePageSrc({loading, inputText, inputValue, tagSpecs, numTags, page, focus}),
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

          const shadowMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
            const material = transparentMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            return mesh;
          })();
          object.add(shadowMesh);

          return object;
        })();
        rend.registerMenuMesh('fileMesh', fileMesh);
        fileMesh.updateMatrixWorld();

        rend.reindex();
        rend.updateMatrixWorld(fileMesh);

        const _updatePages = () => {
          const {planeMesh} = fileMesh;
          const {page} = planeMesh;
          page.update();
        };
        _updatePages();

        const _tabchange = tab => {
          if (tab === 'file') {
            keyboard.tryBlur();

            const {loaded} = npmCacheState;
            if (!loaded) {
              _updateNpm();

              npmCacheState.loaded = true;
            }
          }
        };
        rend.on('tabchange', _tabchange);

        const _trigger = e => {
          const {side} = e;

          const _clickMenu = () => {
            const hoverState = rend.getHoverState(side);
            const {intersectionPoint} = hoverState;

            if (intersectionPoint) {
              const {anchor} = hoverState;
              const onclick = (anchor && anchor.onclick) || '';

              let match;
              if (onclick === 'file:focus') {
                const {inputText} = npmState;
                const {value} = hoverState;
                const valuePx = value * (WIDTH - (250 + (30 * 2)));
                const {index, px} = biolumi.getTextPropertiesFromCoord(inputText, mainFontSpec, valuePx); // XXX this can be folded into the keyboard engine
                const {hmd: hmdStatus} = webvr.getStatus();
                const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
                const keyboardFocusState = keyboard.focus({
                  type: 'file',
                  position: hmdPosition,
                  rotation: hmdRotation,
                  inputText: inputText,
                  inputIndex: index,
                  inputValue: px,
                  fontSpec: mainFontSpec,
                });
                focusState.keyboardFocusState = keyboardFocusState;

                keyboardFocusState.on('update', () => {
                  const {inputText: keyboardInputText} = keyboardFocusState;
                  const {inputText: npmInputText} = npmState;

                  if (keyboardInputText !== npmInputText) {
                    npmState.inputText = keyboardInputText;

                    _updateNpm();
                  }
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
              } else {
                return false;
              }
            } else {
              return false;
            }
          };

          if (_clickMenu()) {
            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger);

        cleanups.push(() => {
          rend.removeListener('tabchange', _tabchange);
          input.removeListener('trigger', _trigger);
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = FileEngine;
