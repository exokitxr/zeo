// const EffectComposer = require('./lib/three-extra/postprocessing/EffectComposer');
// const BlurShader = require('./lib/three-extra/shaders/BlurShader');
const threeModelLib = require('three-model');
const {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  ITEM_MENU_SIZE,
  ITEM_MENU_INNER_SIZE,
  ITEM_MENU_BORDER_SIZE,
  ITEM_MENU_WORLD_SIZE,

  DEFAULT_USER_HEIGHT,
} = require('./lib/constants/menu');

const NUM_POSITIONS = 500 * 1024;
const MENU_RANGE = 4;
const SIDES = ['left', 'right'];

const width = 0.1;
const height = 0.1;
const pixelWidth = 128;
const pixelHeight = 128;
const numFilesPerPage = 10;
const numModsPerPage = 10;
const fontSize = 34;

const _normalizeType = ext => {
  if (ext === 'itm' || ext === 'pls') {
    return ext;
  } else if (
    isImageType(ext) ||
    isAudioType(ext) ||
    isVideoType(ext) ||
    isModelType(ext)
  ) {
    return 'med';
  } else {
    return 'dat';
  }
};
function _roundedRectanglePath({
  top,
  left,
  width,
  height,
  borderRadius,
}) {
  const path = new Path2D();
  path.moveTo(left + borderRadius, top);
  path.lineTo(left + width - borderRadius, top);
  path.quadraticCurveTo(left + width, top, left + width, top + borderRadius);
  path.lineTo(left + width, top + height - borderRadius);
  path.quadraticCurveTo(left + width, top + height, left + width - borderRadius, top + height);
  path.lineTo(left + borderRadius, top + height);
  path.quadraticCurveTo(left, top + height, left, top + height - borderRadius);
  path.lineTo(left, top + borderRadius);
  path.quadraticCurveTo(left, top, left + borderRadius, top);
  return path;
}
const isImageType = ext => /^(?:png|jpg|jfif|gif|svg|bmp)$/i.test(ext);
const isAudioType = ext => ext === 'mp3' || ext === 'ogg' || ext === 'wav';
const isVideoType = ext => ext === 'webm' || ext === 'mp4' || ext === 'mov';
const isModelType = ext => ext === 'obj' || ext === 'dae' || ext === 'fbx' || ext === 'mtl' || ext === 'tar';

const LENS_SHADER = {
  uniforms: {
    textureMap: {
      type: 't',
      value: null,
    },
    opacity: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: [
    "varying vec4 texCoord;",
    "void main() {",
    "  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
    "  vec4 position = projectionMatrix * mvPosition;",
    "  texCoord = position;",
    "  texCoord.xy = 0.5*texCoord.xy + 0.5*texCoord.w;",
    "  gl_Position = position;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D textureMap;",
    "uniform float opacity;",
    "varying vec4 texCoord;",
    "void main() {",
    "  vec4 diffuse = texture2DProj(textureMap, texCoord);",
    "  gl_FragColor = vec4(mix(diffuse.rgb, vec3(0, 0, 0), 0.5), diffuse.a * opacity);",
    "}"
  ].join("\n")
};

class Inventory {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        server: {
          enabled: serverEnabled,
        },
        offline,
        offlinePlugins,
      },
    } = archae;

    const cleanups = [];
    this._cleanup = () => {
      const oldCleanups = cleanups.slice();
      for (let i = 0; i < oldCleanups.length; i++) {
        const cleanup = oldCleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    const _resJson = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.json();
      } else if (res.status === 404) {
        return Promise.resolve(null);
      } else {
        return Promise.reject({
          status: res.status,
          stack: 'API returned invalid status code: ' + res.status,
        });
      }
    };
    const _resArrayBuffer = res => {
      if (res.status >= 200 && res.status < 300) {
        return res.arrayBuffer();
      } else if (res.status === 404) {
        return Promise.resolve(null);
      } else {
        return Promise.reject({
          status: res.status,
          stack: 'API returned invalid status code: ' + res.status,
        });
      }
    };
    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
      img.src = src;
    });
    const _requestImageBitmap = src => _requestImage(src)
      .then(img => createImageBitmap(img, 0, 0, img.width, img.height));
    const _getImageCover = (img, canvas) => {
      const imageAspectRatio = img.width / img.height;
      const canvasAspectRatio = canvas.width / canvas.height;
      let renderableHeight, renderableWidth, xStart, yStart;

      if (imageAspectRatio < canvasAspectRatio) {
        renderableHeight = canvas.height;
        renderableWidth = img.width * (renderableHeight / img.height);
        xStart = (canvas.width - renderableWidth) / 2;
        yStart = 0;
      } else if (imageAspectRatio > canvasAspectRatio) {
        renderableWidth = canvas.width
        renderableHeight = img.height * (renderableWidth / img.width);
        xStart = 0;
        yStart = (canvas.height - renderableHeight) / 2;
      } else {
        renderableHeight = canvas.height;
        renderableWidth = canvas.width;
        xStart = 0;
        yStart = 0;
      }

      return [xStart, yStart, renderableWidth, renderableHeight];
    };
    const imageDataCanvas = document.createElement('canvas');
    const imageDataCtx = imageDataCanvas.getContext('2d');
    const _requestImageData = src => _requestImageBitmap(src)
      .then(img => {
        const {width, height} = img;

        imageDataCanvas.width = width;
        imageDataCanvas.height = height;
        imageDataCtx.drawImage(img, 0, 0);
        return imageDataCtx.getImageData(0, 0, width, height);
      });
    const _cloneImageData = imageData => new ImageData(imageData.data.slice(), imageData.width, imageData.height);

    let remoteMods = [];
    const _requestRemoteMods = () => {
      if (!offline) {
        return fetch('archae/rend/search')
          .then(_resJson)
          .catch(err => {
            console.warn(err);

            return Promise.resolve([]);
          });
      } else {
        return Promise.all(
          offlinePlugins.map(({name, version}) =>
            fetch(`https://my-site.zeovr.io/mods/${name}`)
              .then(_resJson)
          )
        );
      }
    };
    const _refreshRemoteMods = () => _requestRemoteMods()
      .then(newRemoteMods => {
        remoteMods = newRemoteMods;
      });
    _refreshRemoteMods()
      .catch(err => {
        console.warn(err);
      });
    const refreshModsInterval = setInterval(() => {
      _refreshRemoteMods()
        .catch(err => {
          console.warn(err);
        });
    }, 2 * 60 * 1000);
    cleanups.push(() => {
      clearInterval(refreshModsInterval);
    });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/engines/world',
        '/core/engines/tags',
        '/core/engines/wallet',
        '/core/engines/resource',
        '/core/engines/hand',
        '/core/engines/multiplayer',
        '/core/engines/notification',
        '/core/engines/anima',
        '/core/utils/js-utils',
        // '/core/utils/hash-utils',
        '/core/utils/vrid-utils',
        '/core/utils/sprite-utils',
        '/core/utils/menu-utils',
      ]),
      // _requestImageBitmap('/archae/inventory/img/menu.png'),
      _requestImageBitmap('/archae/plugins/_core_engines_inventory/serve/arrow-up.png'),
      _requestImageBitmap('/archae/plugins/_core_engines_inventory/serve/arrow-down.png'),
      _requestImageBitmap('/archae/plugins/_core_engines_inventory/serve/chevron-left.png'),
      _requestImageBitmap('/archae/plugins/_core_engines_inventory/serve/close.png'),
      _requestImageBitmap('/archae/plugins/_core_engines_inventory/serve/triangle-down.png'),
      _requestImageBitmap('/archae/plugins/_core_engines_inventory/serve/link.png'),
      // _requestImageBitmap('/archae/plugins/_core_engines_inventory/serve/box.png'),
      _requestImageData('/archae/plugins/_core_engines_inventory/serve/file.png'),
      _requestImageData('/archae/plugins/_core_engines_inventory/serve/image.png'),
      _requestImageData('/archae/plugins/_core_engines_inventory/serve/audio.png'),
      _requestImageData('/archae/plugins/_core_engines_inventory/serve/video.png'),
      _requestImageData('/archae/plugins/_core_engines_inventory/serve/model.png'),
      // _requestImageBitmap('/archae/inventory/img/color.png'),
    ]).then(([
      [
        bootstrap,
        input,
        three,
        webvr,
        biolumi,
        rend,
        world,
        tags,
        wallet,
        resource,
        hand,
        multiplayer,
        notification,
        anima,
        jsUtils,
        // hashUtils,
        vridUtils,
        spriteUtils,
        menuUtils,
      ],
      // menuImg,
      arrowUpImg,
      arrowDownImg,
      chevronLeftImg,
      closeImg,
      triangleDownImg,
      linkImg,
      // boxImg,
      fileImgData,
      imageImgData,
      audioImgData,
      videoImgData,
      modelImgData,
      // colorImg,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {materials: {assets: assetsMaterial}, sfx} = resource;
        const {base64} = jsUtils;
        // const {murmur} = hashUtils;
        const {vridApi} = vridUtils;

        // const THREEEffectComposer = EffectComposer(THREE);
        // const {THREERenderPass, THREEShaderPass} = THREEEffectComposer;
        // const THREEBlurShader = BlurShader(THREE);
        const threeModel = threeModelLib({THREE});

        const colorWheelImg = menuUtils.getColorWheelImg();
        const _getBoundingBox = (() => {
          const v1 = new THREE.Vector3();

          return o => {
            const scope = new THREE.Box3();
            o.traverse(node => {
              if (node.isMesh) {
                const geometry = node.geometry;

                if ( geometry !== undefined ) {

                  if ( geometry.isGeometry ) {

                    const vertices = geometry.vertices;

                    for ( let i = 0, l = vertices.length; i < l; i ++ ) {

                      v1.copy( vertices[ i ] );
                      v1.applyMatrix4( node.matrixWorld );

                      scope.expandByPoint( v1 );

                    }

                  } else if ( geometry.isBufferGeometry ) {

                    const attribute = geometry.attributes.position;

                    if ( attribute !== undefined ) {

                      for ( let i = 0, l = attribute.count; i < l; i ++ ) {

                        v1.fromBufferAttribute( attribute, i ).applyMatrix4( node.matrixWorld );

                        scope.expandByPoint( v1 );

                      }

                    }

                  }
                }
              }
            });
            return scope;
          };
        })();
        const _computeBoundingSphere = o => {
          o.traverse(node => {
            if (node.frustumCulled) {
              node.frustumCulled = false;
            }
          });

          const boundingSphere = _getBoundingBox(o).getBoundingSphere();
          if (o.geometry) {
            o.geometry.boundingSphere = boundingSphere;
          } else {
            o.geometry = {
              boundingSphere,
            };
          }
          o.frustumCulled = true;
        };

        if (offline) {
          for (let i = 0; i < offlinePlugins.length; i++) {
            const offlinePlugin = offlinePlugins[i];
            const {name: modName, version} = offlinePlugin;
            const remoteMod = remoteMods.find(modSpec => modSpec.name === modName);

            if (remoteMod && remoteMod.metadata && remoteMod.metadata.items && Array.isArray(remoteMod.metadata.items)) {
              const {items} = remoteMod.metadata;

              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const {name: itemName, ext, type = null, attributes = {}} = item;

                fetch(`https://my-site.zeovr.io/img/mods/${modName}/${i}`)
                  .then(_resArrayBuffer)
                  .then(arrayBuffer => base64.encode(arrayBuffer))
                  .then(icon => {
                    const id = _makeId();
                    const ext = 'itm';
                    const path = modName + (type ? ('/' + type) : '');
                    const fullWidth = items.length * 0.5;
                    const position = localMatrix.compose(
                      localVector.set(-(items.length-1)*fullWidth/2 + i*fullWidth/items.length, 1, -1),
                      zeroQuaternion,
                      oneVector,
                    ).toArray();
                    const itemSpec = {
                      type: 'asset',
                      id: _makeId(),
                      name: itemName,
                      displayName: itemName,
                      attributes: {
                        type: {value: 'asset'},
                        id: {value: id},
                        name: {value: itemName},
                        ext: {value: ext},
                        path: {value: path},
                        attributes: {value: attributes},
                        icon: {value: icon},
                        position: {value: position},
                        physics: {value: true},
                        visible: {value: true},
                        open: {value: false},
                      },
                      metadata: {},
                    };
                    wallet.makeItem(itemSpec);
                  })
                  .catch(err => {
                    console.warn(err);
                  });
              }
            }
          }
        }

        const rowHeight = 100;
        const localColor = new THREE.Color();
        const renderAttributes = (canvas, ctx, attributes, attributeSpecs, fontSize, x, y, w, h, menuState) => {
          ctx.font = `${fontSize}px Open sans`;

          const attributeNames = Object.keys(attributeSpecs);
          for (let i = Math.min(attributeNames.length - 1, (menuState.page + 1) * 7); i >= (menuState.page * 7); i--) {
            const attributeName = attributeNames[i];
            const attributeSpec = attributeSpecs[attributeName];
            const {type} = attributeSpec;

            const attributeObject = attributes[attributeName] || {};
            let {value} = attributeObject;
            if (value === undefined) {
              value = attributeSpec.value;
            }

            const di = i - menuState.page * 7;

            if (type === 'matrix') {
              ctx.fillStyle = '#EEE';
              ctx.fillRect(x, y + h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2);
              ctx.fillStyle = '#111';
              ctx.fillText(value.join(','), x, y + h + fontSize*2 - fontSize*0.3 + di*rowHeight, ITEM_MENU_INNER_SIZE);
            } else if (type === 'vector') {
              ctx.fillStyle = '#EEE';
              ctx.fillRect(x, y + h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2);
              ctx.fillStyle = '#111';
              ctx.fillText(value.join(','), x, y + h + fontSize*2 - fontSize*0.3 + di*rowHeight, ITEM_MENU_INNER_SIZE);
            } else if (type === 'text') {
              ctx.fillStyle = '#EEE';
              ctx.fillRect(x, y + h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2);
              ctx.fillStyle = '#111';
              ctx.fillText(value, x, y + h + fontSize*2 - fontSize*0.3 + di*rowHeight, ITEM_MENU_INNER_SIZE);
            } else if (type === 'number') {
              const {min, max} = attributeSpec;

              if (min === undefined) {
                min = 0;
              }
              if (max === undefined) {
                max = 10;
              }

              const factor = (value - min) / (max - min);

              ctx.fillStyle = '#CCC';
              ctx.fillRect(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE, 5);
              ctx.fillStyle = '#ff4b4b';
              ctx.fillRect(x + (factor * ITEM_MENU_INNER_SIZE), y + h - 25 + di*rowHeight, 5, 25 + 5 + 25);
            } else if (type === 'select') {
              if (menuState.focus !== attributeName) {
                ctx.fillStyle = '#FFF';
                ctx.fillRect(x, y + h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2);

                ctx.fillStyle = '#111';
                ctx.fillText(value, x, y + h + fontSize*2 - fontSize*0.5 + di*rowHeight, ITEM_MENU_INNER_SIZE);
                ctx.drawImage(triangleDownImg, w + ITEM_MENU_INNER_SIZE - fontSize*2, y + h + di*rowHeight, fontSize*2, fontSize*2);

                ctx.strokeStyle = '#111';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2);
              } else {
                const {options} = attributeSpec;

                ctx.fillStyle = '#FFF';
                ctx.fillRect(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE, Math.max(options.length, 1) * fontSize*2);

                for (let j = 0; j < options.length; j++) {
                  const option = options[j];

                  if (value === option) {
                    ctx.fillStyle = '#EEE';
                    ctx.fillRect(x, y + h + di*rowHeight + j*fontSize*2, ITEM_MENU_INNER_SIZE, fontSize*2);
                  }

                  ctx.fillStyle = '#111';
                  ctx.fillText(option, x, y + h + fontSize*2 - fontSize*0.5 + di*rowHeight + j*fontSize*2, ITEM_MENU_INNER_SIZE);
                }

                ctx.strokeStyle = '#111';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE, Math.max(options.length, 1) * fontSize*2);
              }
            } else if (type === 'color') {
              ctx.strokeStyle = '#111';
              ctx.lineWidth = 3;
              ctx.strokeRect(x, y + h + di*rowHeight, fontSize*2, fontSize*2);
              ctx.fillStyle = value;
              ctx.fillRect(x + 5, y + h + 5 + di*rowHeight, fontSize*2 - 5*2, fontSize*2 - 5*2);
              ctx.fillStyle = '#EEE';
              ctx.fillRect(x + fontSize*2, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE - fontSize*2, fontSize*2);
              ctx.fillStyle = '#111';
              ctx.fillText(value, x + fontSize*2, y + h + fontSize*2 - fontSize*0.3 + di*rowHeight, ITEM_MENU_INNER_SIZE);

              if (menuState.focus === attributeName) {
                ctx.drawImage(colorWheelImg, x, y + h + di*rowHeight, 256, 256);
              }
            } else if (type === 'checkbox') {
              if (value) {
                ctx.strokeStyle = '#111';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y + h + di*rowHeight, 60, 30);

                ctx.fillStyle = '#111';
                ctx.fillRect(x + 30, y + h + 5 + di*rowHeight, (60 - 5*2)/2, 30 - 5*2);
              } else {
                ctx.strokeStyle = '#CCC';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y + h + di*rowHeight, 60, 30);

                ctx.fillStyle = '#CCC';
                ctx.fillRect(x + 5, y + h + 5 + di*rowHeight, (60 - 5*2)/2, 30 - 5*2);
              }
            } else if (type === 'file') {
              ctx.fillStyle = '#EEE';
              ctx.fillRect(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE - fontSize*2, fontSize*2);
              ctx.fillStyle = '#111';
              ctx.fillText(value, x, y + h + fontSize*2 - fontSize*0.3 + di*rowHeight, ITEM_MENU_INNER_SIZE);
              ctx.drawImage(linkImg, x + ITEM_MENU_INNER_SIZE - fontSize*2, y + h + di*rowHeight, fontSize*2, fontSize*2);
            }
          }

          const barSize = 80;
          const numPages = Math.max(Math.ceil(attributeNames.length / 7), 1);
          ctx.fillStyle = '#CCC';
          ctx.fillRect(canvas.width - 150 + (barSize-30)/2, 150 + barSize, 30, canvas.height - 150 - barSize*2);
          if (numPages > 1) {
            ctx.fillStyle = '#ff4b4b';
            ctx.fillRect(
              canvas.width - 150 + (barSize-30)/2, 150 + barSize + _snapToPixel(canvas.height - 150 - barSize*2, numPages, menuState.barValue),
              30, (canvas.height - 150 - barSize*2) / numPages
            );
          }
          ctx.drawImage(arrowUpImg, canvas.width - 150, 150, barSize, barSize);
          ctx.drawImage(arrowDownImg, canvas.width - 150, canvas.height - barSize, barSize, barSize);
        };
        const getAttributesAnchors = (result, attributes, attributeSpecs, fontSize, x, y, w, h, menuState, {focusAttribute, update}) => {
          const _pushAttributeAnchor = (x, y, w, h, name, type, newValue) => {
            _pushAnchor(result, x, y, w, h, (e, hoverState) => {
              if (type === 'number') {
                const attributeSpec = attributeSpecs[name];
                const {min, max, step} = attributeSpecs[name];

                const fx = (hoverState.x - x) / w;

                newValue = min + (fx * (max - min));
                if (step > 0) {
                  newValue = _roundToDecimals(Math.round(newValue / step) * step, 8);
                }
              } else if (type === 'select') {
                // nothing
              } else if (type === 'color') {
                if (typeof newValue === 'function') {
                  const fx = (hoverState.x - x) / w;
                  const fy = (hoverState.y - y) / h;

                  newValue = newValue(fx, fy);
                }
              } else if (type === 'checkbox') {
                // nothing
              }

              focusAttribute({
                name,
                type,
                newValue,
              });
            });
          };

          const attributeNames = Object.keys(attributeSpecs);
          for (let i = menuState.page * 7; i < attributeNames.length && i < ((menuState.page + 1) * 7); i++) {
            const attributeName = attributeNames[i];
            const attributeSpec = attributeSpecs[attributeName];
            const {type} = attributeSpec;

            const attributeObject = attributes[attributeName] || {};
            let {value} = attributeObject;
            if (value === undefined) {
              value = attributeSpec.value;
            }

            const di = i - menuState.page * 7;

            if (type === 'matrix') {
              _pushAttributeAnchor(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2, attributeName, type);
            } else if (type === 'vector') {
              _pushAttributeAnchor(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2, attributeName, type);
            } else if (type === 'text') {
              _pushAttributeAnchor(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2, attributeName, type);
            } else if (type === 'number') {
              _pushAttributeAnchor(x, y + h - 25 + di*rowHeight, ITEM_MENU_INNER_SIZE, 25 + 5 + 25, attributeName, type);
            } else if (type === 'select') {
              if (menuState.focus !== attributeName) {
                _pushAttributeAnchor(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2, attributeName, type);
              } else {
                const {options} = attributeSpec;
                for (let j = 0; j < options.length; j++) {
                  _pushAttributeAnchor(x, y + h + di*rowHeight + j*fontSize*2, ITEM_MENU_INNER_SIZE, fontSize*2, attributeName, type, options[j]);
                }
              }
            } else if (type === 'color') {
              if (menuState.focus === attributeName) {
                _pushAttributeAnchor(x, y + h + di*rowHeight, 256, 256, attributeName, type, (fx, fy) => '#' + localColor.setHex(colorWheelImg.getColor(fx, fy)).getHexString());
              }

              _pushAttributeAnchor(x, y + h + di*rowHeight, fontSize*2, fontSize*2, attributeName, type);
              _pushAttributeAnchor(x + fontSize*2, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE - fontSize*2, fontSize*2, attributeName, type);
            } else if (type === 'checkbox') {
              _pushAttributeAnchor(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE, 30, attributeName, type, !value);
            } else if (type === 'file') {
              _pushAttributeAnchor(x, y + h + di*rowHeight, ITEM_MENU_INNER_SIZE - fontSize*2, fontSize*2, attributeName, type);
            }
          }

          const barSize = 80;
          const numPages = Math.ceil(attributeNames.length / 7);
          _pushAnchor(result, canvas.width - 150 + (barSize-30)/2, 150 + barSize, 30, canvas.height - 150 - barSize*2, e => {
            if (numPages > 0) {
              const {side} = e;

              onmove = () => {
                const hoverState = uiTracker.getHoverState(side);
                menuState.barValue = Math.min(Math.max(hoverState.y - (150 + barSize), 0), canvas.height - 150 - barSize*2) / (canvas.height - 150 - barSize*2);
                const {page: oldPage} = menuState;
                const newPage = _snapToIndex(numPages, menuState.barValue);

                if (newPage !== oldPage) {
                  menuState.page = newPage;

                  _renderMenu();
                  plane.anchors = _getAnchors();
                }
              };
            }
          });
          _pushAnchor(result, canvas.width - 150, 150, barSize, barSize, e => {
            const {page: oldPage} = menuState;
            const newPage = Math.max(menuState.page - 1, 0);

            if (newPage !== oldPage) {
              menuState.page = newPage;
              menuState.barValue = menuState.page / (numPages - 1);

              _renderMenu();
              plane.anchors = _getAnchors();
            }
          });
          _pushAnchor(result, canvas.width - 150, canvas.height - barSize, barSize, barSize, e => {
            const {page: oldPage} = menuState;
            const newPage = Math.min(menuState.page + 1, numPages - 1);

            if (newPage !== oldPage) {
              menuState.page = newPage;
              menuState.barValue = menuState.page / (numPages - 1);

              _renderMenu();
              plane.anchors = _getAnchors();
            }
          });
        };

        const _updateInstalled = () => {
          for (let i = 0; i < remoteMods.length; i++) {
            const remoteMod = remoteMods[i];
            const installed = tags.getTagMeshes()
              .some(({item}) => item.type === 'entity' && item.module === remoteMod.displayName);
            remoteMod.installed = installed;
          }
        };
        _updateInstalled();

        const _quantizeAssets = assets => {
          const assetIndex = {};
          for (let i = 0; i < assets.length; i++) {
            const assetSpec = assets[i];
            const {id} = assetSpec;

            let entry = assetIndex[id];
            if (!entry) {
              entry = _clone(assetSpec);
              // entry.assets = [];
              assetIndex[id] = entry;
            }
            // entry.assets.push(assetSpec);
          }
          return Object.keys(assetIndex).map(k => assetIndex[k]);
        };
        let assets = _quantizeAssets(wallet.getAssets());
        // let equipments = wallet.getEquipments();
        /* let mods = tags.getTagMeshes()
          .filter(({item}) => item.type === 'entity')
          .map(({item}) => item); */
        const _worldAdd = tagMesh => {
          const {item} = tagMesh;
          if (item.type === 'entity') {
            // mods.push(item);
            /* localMods = _getLocalMods();
            serverAnchors = _getServerAnchors();
            modAnchors = _getModAnchors();
            serverBarValue = 0;
            serverPage = 0;
            serverPages = localMods.length > numModsPerPage ? Math.ceil(localMods.length / numModsPerPage) : 0;

            _updateInstalled();

            _renderMenu();

            serverAnchors = _getServerAnchors();
            modAnchors = _getModAnchors();
            plane.anchors = _getAnchors(); */

            planeMeshLeft.render();
            planeLeft.updateAnchors();
            assetsMesh.render();
          }
        };
        world.on('add', _worldAdd);
        const _walletAssets = newAssets => {
          assets = _quantizeAssets(newAssets);
          /* localAssets = _getLocalAssets();
          localAsset = null;
          inventoryPage = 0;
          inventoryPages = localAssets.length > numFilesPerPage ? Math.ceil(localAssets.length / numFilesPerPage) : 0;
          inventoryBarValue = 0; */

          _renderMenu();
        };
        wallet.on('assets', _walletAssets);

        let planeMeshes = {};
        let numPlaneMeshCloses = 0;
        const _gcPlaneMeshes = () => {
          if (++numPlaneMeshCloses >= 10) {
            const newPlaneMeshes = {};
            for (const id in planeMeshes) {
              const planeMesh = planeMeshes[id]

              if (planeMesh) {
                planeMeshes[id] = planeMesh;
              }
            }
            planeMeshes = newPlaneMeshes;
            numPlaneMeshCloses = 0;
          }
        };
        const _openAssetInstance = grabbable => {
          const file = grabbable.getFile();

          if (file !== null) {
            const {assetId, ext, position, rotation, scale} = grabbable;

            // if (_normalizeType(ext) === 'med') {
            if (isImageType(ext)) {
              const canvas = document.createElement('canvas');
              const size = 1024;
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');

              const texture = new THREE.Texture(
                canvas,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping,
                THREE.ClampToEdgeWrapping,
                THREE.LinearFilter,
                THREE.LinearFilter,
                THREE.RGBAFormat,
                THREE.UnsignedByteType,
                16
              );

              _requestImageBitmap(file.getUrl(), {
                credentials: 'include',
              })
                .then(img => {
                  const [x, y, w, h] = _getImageCover(img, canvas);
                  ctx.drawImage(img, x, y, w, h);
                  texture.needsUpdate = true;
                })
                .catch(err => {
                  console.warn(err);
                });

              const planeMesh = _makePlaneMesh(1, 1, texture);
              planeMesh.position.copy(position);
              planeMesh.quaternion.copy(rotation);
              planeMesh.scale.copy(scale);
              planeMesh.updateMatrixWorld();

              planeMesh.destroy = function() {
                this.geometry.dispose();
                this.material.dispose();
              };

              scene.add(planeMesh);

              planeMeshes[assetId] = planeMesh;
            } else if (isModelType(ext)) {
              threeModel.requestModel({
                source: {
                  url: file.getUrl(),
                },
                type: ext,
                credentials: file.local ? 'include' : null,
              })
                .then(modelMeshInner => {
                  _computeBoundingSphere(modelMeshInner);

                  const modelMesh = new THREE.Object3D();
                  modelMesh.add(modelMeshInner);
                  modelMesh.position.copy(position);
                  modelMesh.quaternion.copy(rotation);
                  modelMesh.scale.copy(scale);
                  modelMesh.updateMatrixWorld();

                  modelMesh.destroy = () => {
                    // modelMeshInner.destroy(); // XXX
                  };

                  scene.add(modelMesh);

                  planeMeshes[assetId] = modelMesh;
                })
                .catch(err => {
                  console.warn(err);
                });
            }
          }
        };
        wallet.on('menuopen', _openAssetInstance);
        const _closeAssetInstance = grabbable => {
          for (const assetId in planeMeshes) {
            const planeMesh = planeMeshes[assetId];
            if (planeMesh.grabbable === grabbable) {
              const {plane} = planeMesh;

              uiTracker.removePlane(plane);

              scene.remove(planeMesh);
              planeMesh.destroy();
              planeMeshes[assetId] = null;

              _gcPlaneMeshes();

              break;
            }
          }
        };
        wallet.on('menuclose', _closeAssetInstance);

        const localVector = new THREE.Vector3();
        const localVector2 = new THREE.Vector3();
        const localQuaternion = new THREE.Quaternion();
        const localMatrix = new THREE.Matrix4();
        const zeroQuaternion = new THREE.Quaternion();
        const oneVector = new THREE.Vector3(1, 1, 1);
        const zeroVector = new THREE.Vector3();
        const pixelSize = 0.01;

        const _requestModFileImageData = modSpec => resource.getModFileImageData(modSpec.displayName, 0)
          .then(arrayBuffer => ({
            width: 16,
            height: 16,
            data: new Uint8Array(arrayBuffer),
          }));
        const _requestAssetImageData = assetSpec => (() => {
          if (assetSpec.ext === 'itm') {
            if (assetSpec.json && assetSpec.json.data && assetSpec.json.data.icon && typeof assetSpec.json.data.icon === 'string') {
              return new Promise((accept, reject) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                  imageDataCanvas.width = img.naturalWidth;
                  imageDataCanvas.height = img.naturalHeight;
                  imageDataCtx.drawImage(img, 0, 0);
                  const imageData = imageDataCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
                  accept(imageData.data.buffer);
                };
                img.onerror = err => {
                  reject(err);
                };
                img.src = 'data:application/octet-stream;base64,' + assetSpec.json.data.icon;
              });
            } else {
              return resource.getItemImageData(assetSpec.name);
            }
          } else /* if (asset.ext === 'files') */ {
            return resource.getFileImageData(assetSpec.name);
          }
          /* } else if (type === 'mod') {
            return resource.getModImageData(name);
          } else if (type === 'skin') {
            return resource.getSkinImageData(name);
          } else {
            return Promise.resolve(null);
          } */
        })().then(arrayBuffer => ({
          width: 16,
          height: 16,
          data: new Uint8Array(arrayBuffer),
        }));

        const _makeRenderTarget = (width, height) => new THREE.WebGLRenderTarget(width, height, {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          // format: THREE.RGBFormat,
          format: THREE.RGBAFormat,
        });

        const uiTracker = biolumi.makeUiTracker();

        const menuState = {
          open: false,
          /* position: new THREE.Vector3(0, DEFAULT_USER_HEIGHT, -1.5),
          rotation: new THREE.Quaternion(),
          scale: new THREE.Vector3(1, 1, 1), */
          barValue: 0,
          page: 0,
        };
        const planeLeftState = {
          barValue: 0,
          page: 0,
        };
        const planeRightState = {
          barValue: 0,
          page: 0,
        };

        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const ctx = canvas.getContext('2d');
        const texture = new THREE.Texture(
          canvas,
          THREE.UVMapping,
          THREE.ClampToEdgeWrapping,
          THREE.ClampToEdgeWrapping,
          THREE.NearestFilter,
          THREE.NearestFilter,
          THREE.RGBAFormat,
          THREE.UnsignedByteType
        );

        let tab = 'status';
        let subtab = 'itm';
        const _getLocalAssets = () => assets
          .filter(assetSpec => {
            if (tab === 'files') {
              return _normalizeType(assetSpec.ext) === subtab;
            } else {
              return true;
            }
          })
          .slice(inventoryPage * numFilesPerPage, (inventoryPage + 1) * numFilesPerPage);
        const _getLocalMods = () => {
          if (subtab === 'installed') {
            return remoteMods
              .filter(modSpec => modSpec.installed);
          } else if (subtab === 'store') {
            return remoteMods
              .filter(modSpec => !modSpec.local);
          } else if (subtab === 'local') {
            return remoteMods
              .filter(modSpec => modSpec.local);
          } else {
            return [];
          }
        };

        /* let tabIndex = 0;
        let tabType = 'item';
        let inventoryPage = 0;
        let localAssets = _getLocalAssets();
        let localAsset = null;
        const localTabAssets = _getLocalAssets();
        let inventoryPages = localAssets.length > numFilesPerPage ? Math.ceil(localAssets.length / numFilesPerPage) : 0;
        let inventoryBarValue = 0;
        const inventoryIndices = {
          left: -1,
          right: -1,
        };
        let serverPage = 0;
        let localMods = _getLocalMods();
        let localMod = null;
        let modReadmeImg = null;
        let modReadmeImgPromise = null;
        let modBarValue = 0;
        let modPage = 0;
        let modPages = 0;
        let serverPages = localMods.length > numModsPerPage ? Math.ceil(localMods.length / numModsPerPage) : 1;
        let serverBarValue = 0;
        let serverIndex = -1; */
        let localImage = null;

        const _snapToIndex = (steps, value) => Math.min(Math.floor(steps * value), steps - 1);
        const _snapToPixel = (max, steps, value) => {
          const stepIndex = _snapToIndex(steps, value);
          const stepSize = max / steps;
          return stepIndex * stepSize;
        };

        let localProfileImg = null;
        let remoteProfiles = [];
        const _requestLocalProfilePicture = () => vridApi.get('name')
          .then(username => {
            if (username) {
              return _requestImageBitmap(`https://my-site.zeovr.io/profile/picture/${username}`)
                .catch(err => {
                  console.warn(err);

                  return Promise.resolve(null);
                });
            } else {
              return Promise.resolve(null);
            }
          });
        const _requestRemoteProfilePicture = username => _requestImageBitmap(`https://my-site.zeovr.io/profile/picture/${username}`)
          .catch(err => {
            console.warn(err);

            return Promise.resolve(null);
          });
        (() => {
          _requestLocalProfilePicture()
            .then(newProfileImg => {
              localProfileImg = newProfileImg;

              _renderMenu();
            })
            .catch(err => {
              console.warn(err);
            });
          const usernames = multiplayer.getUsers();
          Promise.all(usernames.map(username => _requestRemoteProfilePicture(username)))
            .then(profileImgs => {
              for (let i = 0; i < usernames.length; i++) {
                const username = usernames[i];
                const profileImg = profileImgs[i];
                remoteProfiles.push({
                  username,
                  profileImg,
                });
              }

              _renderMenu();
            })
            .catch(err => {
              console.warn(err);
            });
        })();
        const _playerEnter = ({id, username}) => {
          _requestRemoteProfilePicture(username)
            .then(profileImg => {
              remoteProfiles.push({
                username,
                profileImg,
              });

              _renderMenu();
            })
            .catch(err => {
              console.warn(err);
            });
        };
        multiplayer.on('playerEnter', _playerEnter);
        const _playerLeave = ({id, username}) => {
          const index = remoteProfiles.findIndex(remoteProfile => remoteProfile.username === username);
          if (index !== -1) {
            remoteProfiles.splice(index, 1);
          }

          _renderMenu();
        };
        multiplayer.on('playerLeave', _playerLeave);
        cleanups.push(() => {
          multiplayer.removeListener('playerEnter', _playerEnter);
          multiplayer.removeListener('_playerLeave', _playerLeave);
        });

        const _renderMenu = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.fillRect(canvas.width * 0/8, -10, canvas.width / 8, 10);

          ctx.fillStyle = '#EEE';
          ctx.fillRect(0, 0, canvas.width, 150);

          if (localProfileImg) {
            ctx.drawImage(localProfileImg, canvas.width * 0.8, 20, 100, 100);
          } else {
            ctx.fillStyle = '#EEE';
            ctx.fillRect(canvas.width * 0.8, 20, 100, 100);
          }
          ctx.fillStyle = '#111';
          ctx.fillText(bootstrap.getUsername(), canvas.width * 0.8 + 100 + 30, 90);

          if (!focusState.type) {
            ctx.font = `${fontSize}px Open sans`;
            for (let i = 0; i < remoteProfiles.length; i++) {
              const {username: remoteUsername, profileImg: remoteProfileImg} = remoteProfiles[i];

              if (remoteProfileImg) {
                ctx.drawImage(remoteProfileImg, 40, 150 + 40 + i*(100 + 40), 100, 100);

                ctx.fillStyle = '#111';
                ctx.fillText(remoteUsername, 40 + 100 + 30, 150 + 100 + i*(100 + 40));
              } else {
                ctx.fillStyle = '#EEE';
                ctx.fillRect(40, 150 + 40 + i*(100 + 40), 100, 100);
              }
            }
          } else if (focusState.type === 'leftPane' || focusState.type === 'rightPane') {
            const {target} = focusState;

            ctx.drawImage(chevronLeftImg, ITEM_MENU_BORDER_SIZE, 150, fontSize*2 + ITEM_MENU_BORDER_SIZE, fontSize*2 + ITEM_MENU_BORDER_SIZE);
            ctx.fillStyle = '#111';
            ctx.fillText(`${target.name}.${target.ext}`, ITEM_MENU_BORDER_SIZE + fontSize*2 + ITEM_MENU_BORDER_SIZE, 150 + fontSize*2 + ITEM_MENU_BORDER_SIZE - 40);
            ctx.drawImage(closeImg, ITEM_MENU_INNER_SIZE - fontSize*2, 150, fontSize*2 + ITEM_MENU_BORDER_SIZE, fontSize*2 + ITEM_MENU_BORDER_SIZE);

            const {ext} = target;
            if (ext === 'itm') {
              const {json} = target;

              if (json && json.data && json.data.attributes && typeof json.data.path === 'string') {
                const path = json.data.path;
                const match = path.match(/^(.+?)\/(.+?)$/);

                if (match) {
                  const moduleName = match[1];
                  const itemName = match[2];
                  const module = remoteMods.find(moduleSpec => moduleSpec.name === moduleName);

                  if (module) {
                    const item = module.metadata.items.find(itemSpec => itemSpec.type === itemName);

                    if (item) {
                      const attributes = (json && json.data && json.data.attributes && typeof json.data.attributes === 'object' && !Array.isArray(json.data.attributes)) ?
                        json.data.attributes
                        : {};
                      const {attributes: attributeSpecs} = item;
                      renderAttributes(canvas, ctx, attributes, attributeSpecs, fontSize, ITEM_MENU_BORDER_SIZE, 150 + fontSize*2, ITEM_MENU_BORDER_SIZE, ITEM_MENU_BORDER_SIZE, itemMenuState);
                      plane.anchors = _getAnchors();
                    }
                  }
                }
              }
            }
          }
          texture.needsUpdate = true;
        };

        const menuMesh = new THREE.Object3D();
        menuMesh.visible = false;
        scene.add(menuMesh);

        const plane = new THREE.Object3D();
        plane.width = WIDTH;
        plane.height = HEIGHT;
        plane.worldWidth = WORLD_WIDTH;
        plane.worldHeight = WORLD_HEIGHT;
        plane.open = false;
        const _pushAnchor = (anchors, x, y, w, h, triggerdown = null) => {
          anchors.push({
            left: x,
            right: x + w,
            top: y,
            bottom: y + h,
            triggerdown,
          });
        };
        let onmove = null;

        let focusState = {};
        const itemMenuState = {
          focus: null,
          barValue: 0,
          page: 0,
        };
        const _setFocus = newFocusState => {
          focusState = newFocusState;

          _renderMenu();
          planeMeshLeft.render();
          planeLeft.updateAnchors();
          planeMeshRight.render();
          planeRight.updateAnchors();
          assetsMesh.render();
          plane.anchors = _getAnchors();
        };

        class InventoryAssetInstance {
          constructor(item) {
            this.item = item;
          }

          setAttribute(name, value) {
            const _setAttribute = (attributes, name, value) => {
              const attributeSpec = attributes[name];
              if (!attributeSpec) {
                attributeSpec.json.data.attributes[name] = {
                  value,
                };
              } else {
                attributeSpec.value = value;
              }
            };

            _setAttribute(this.item.json.data.attributes, name, value);

            vridApi.get('assets')
              .then(assets => {
                assets = assets || [];

                const assetSpec = assets.find(assetSpec => assetSpec.id === this.item.id);
                _setAttribute(assetSpec.json.data.attributes, name, value);

                return vridApi.set('assets', assets);
              })
              .catch(err => {
                console.warn(err);
              });
          }
        }

        const _getAnchors = () => {
          const result = [];

          if (focusState.type === 'leftPane' || focusState.type === 'rightPane') {
            _pushAnchor(result, ITEM_MENU_BORDER_SIZE, 150, fontSize*2 + ITEM_MENU_BORDER_SIZE, fontSize*2 + ITEM_MENU_BORDER_SIZE, (e, hoverState) => {
              _setFocus({});
            });
            _pushAnchor(result, ITEM_MENU_INNER_SIZE - fontSize*2, 150, fontSize*2 + ITEM_MENU_BORDER_SIZE, fontSize*2 + ITEM_MENU_BORDER_SIZE, (e, hoverState) => {
              if (focusState.type === 'leftPane') {
                wallet.destroyItem(focusState.target);

                _setFocus({});
              } else if (focusState.type === 'rightPane') {
                const {target} = focusState;

                assets.splice(assets.findIndex(assetSpec => assetSpec.id === target.id), 1);

                vridApi.get('assets')
                  .then(assets => {
                    assets = assets || [];
                    assets.splice(assets.findIndex(assetSpec => assetSpec.id === target.id), 1);

                    return vridApi.set('assets', assets);
                  })
                  .catch(err => {
                    console.warn(err);
                  });

                _setFocus({});
              }
            });

            const {target} = focusState;
            const {ext} = target;
            if (ext === 'itm') {
              const {json} = target;

              if (json && json.data && json.data.attributes && typeof json.data.path === 'string') {
                const path = json.data.path;
                const match = path.match(/^(.+?)\/(.+?)$/);

                if (match) {
                  const moduleName = match[1];
                  const itemName = match[2];
                  const module = remoteMods.find(moduleSpec => moduleSpec.name === moduleName);

                  if (module) {
                    const item = module.metadata.items.find(itemSpec => itemSpec.type === itemName);

                    if (item) {
                      const attributes = (json && json.data && json.data.attributes && typeof json.data.attributes === 'object' && !Array.isArray(json.data.attributes)) ?
                        json.data.attributes
                        : {};
                      const {attributes: attributeSpecs} = item;

                      getAttributesAnchors(result, attributes, attributeSpecs, fontSize, ITEM_MENU_BORDER_SIZE, 150 + fontSize*2, ITEM_MENU_BORDER_SIZE, ITEM_MENU_BORDER_SIZE, itemMenuState, {
                        focusAttribute: ({name: attributeName, type, newValue}) => {
                          const grabbable = (() => {
                            if (focusState.type === 'leftPane') {
                              return wallet.getAssetInstances().find(assetInstance => assetInstance.assetId === target.assetId);
                            } else if (focusState.type === 'rightPane') {
                              return new InventoryAssetInstance(target);
                            } else {
                              return null;
                            }
                          })();

                          if (type === 'number') {
                            grabbable.setAttribute(attributeName, newValue);

                            itemMenuState.focus = null;
                          } else if (type === 'select') {
                            if (newValue !== undefined) {
                              grabbable.setAttribute(attributeName, newValue);

                              itemMenuState.focus = null;
                            } else {
                              itemMenuState.focus = attributeName;
                            }
                          } else if (type === 'color') {
                            if (newValue !== undefined) {
                              grabbable.setAttribute(attributeName, newValue);

                              itemMenuState.focus = null;
                            } else {
                              itemMenuState.focus = attributeName;
                            }
                          } else if (type === 'checkbox') {
                            grabbable.setAttribute(attributeName, newValue);

                            itemMenuState.focus = null;
                          } else {
                            itemMenuState.focus = null;
                          }

                          _renderMenu();
                          plane.anchors = _getAnchors();
                        },
                        update: () => {
                          _renderMenu();
                          plane.anchors = _getAnchors();
                        },
                      });
                    }
                  }
                }
              }
            }
          }
          return result;
        };
        plane.anchors = _getAnchors();
        menuMesh.add(plane);
        uiTracker.addPlane(plane);

        /* const lensMesh = (() => {
          const object = new THREE.Object3D();
          // object.position.set(0, 0, 0);

          const width = window.innerWidth * window.devicePixelRatio / 4;
          const height = window.innerHeight * window.devicePixelRatio / 4;
          const renderTarget = _makeRenderTarget(width, height);
          const render = (() => {
            const blurShader = {
              uniforms: THREE.UniformsUtils.clone(THREEBlurShader.uniforms),
              vertexShader: THREEBlurShader.vertexShader,
              fragmentShader: THREEBlurShader.fragmentShader,
            };

            const composer = new THREEEffectComposer(renderer, renderTarget);
            const renderPass = new THREERenderPass(scene, camera);
            composer.addPass(renderPass);
            const blurPass = new THREEShaderPass(blurShader);
            composer.addPass(blurPass);
            composer.addPass(blurPass);
            composer.addPass(blurPass);

            return (scene, camera) => {
              renderPass.scene = scene;
              renderPass.camera = camera;

              composer.render();
              renderer.setRenderTarget(null);
            };
          })();
          object.render = render;

          const planeMesh = (() => {
            const geometry = new THREE.SphereBufferGeometry(3, 8, 6);
            const material = (() => {
              const shaderUniforms = THREE.UniformsUtils.clone(LENS_SHADER.uniforms);
              const shaderMaterial = new THREE.ShaderMaterial({
                uniforms: shaderUniforms,
                vertexShader: LENS_SHADER.vertexShader,
                fragmentShader: LENS_SHADER.fragmentShader,
                side: THREE.BackSide,
                transparent: true,
              })
              shaderMaterial.uniforms.textureMap.value = renderTarget.texture;
              // shaderMaterial.polygonOffset = true;
              // shaderMaterial.polygonOffsetFactor = -1;
              return shaderMaterial;
            })();

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          return object;
        })();
        menuMesh.add(lensMesh); */

        const _makePlaneMesh = (width, height, texture) => {
          const geometry = new THREE.PlaneBufferGeometry(width, height);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.5,
            // renderOrder: -1,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.frustumCulled = false;
          return mesh;
        };
        const planeMesh = _makePlaneMesh(WORLD_WIDTH, WORLD_HEIGHT, texture);
        menuMesh.add(planeMesh);

        const planeMeshLeft = (() => {
          const canvas = document.createElement('canvas');
          canvas.width = WIDTH;
          canvas.height = HEIGHT;
          const ctx = canvas.getContext('2d')

          const texture = new THREE.Texture(
            canvas,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.NearestFilter,
            THREE.NearestFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType
          );
          texture.needsUpdate = true;

          const planeMeshLeft = _makePlaneMesh(WORLD_WIDTH, WORLD_HEIGHT, texture);
          const s = Math.sqrt(Math.pow(WORLD_WIDTH, 2) / 2);
          planeMeshLeft.position.set(-WORLD_WIDTH/2 - s/2, 0, s/2);
          planeMeshLeft.quaternion.setFromAxisAngle(localVector.set(0, 1, 0), Math.PI/4);
          planeMeshLeft.updateMatrixWorld();

          const _render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#EEE';
            ctx.fillRect(0, 0, canvas.width, 150);

            ctx.fillStyle = '#111';
            ctx.font = `${fontSize*1.6}px Open sans`;
            ctx.fillText('Server', 60, fontSize*2 + 35);

            if (focusState.type === 'grab' && SIDES.some(side => focusState.targets[side] && focusState.targets[side].ext === 'wld')) {
              const boxPath = _roundedRectanglePath({
                left: 50,
                top: 150 + 50,
                width: canvas.width - 50*2,
                height: canvas.height - 150 - 50*2,
                borderRadius: 20,
              });
              ctx.lineWidth = 10;
              ctx.strokeStyle = '#EEE';
              ctx.stroke(boxPath);

              ctx.font = `100px Open sans`;

              ctx.fillText('Load world', canvas.width/2 - ctx.measureText('Load world').width/2, canvas.height/2 + 100/2);
            } else {
              const unownedAssetInstances = wallet.getAssetInstances().filter(assetInstance => !assetInstance.owner);
              ctx.font = `50px Open sans`;

              const startI = planeLeftState.page * 7;
              for (let i = startI; i < unownedAssetInstances.length; i++) {
                const assetInstance = unownedAssetInstances[i];
                const di = i - startI;
                if (focusState.type === 'leftPane' && focusState.target.assetId === assetInstance.assetId) {
                  ctx.fillStyle = '#111';
                  ctx.fillRect(0, 150 + di * (canvas.height-150)/7, canvas.width - 200, (canvas.height-150)/7);
                  ctx.fillStyle = '#FFF';
                } else {
                  ctx.fillStyle = '#111';
                }

                const boxPath = _roundedRectanglePath({
                  left: 50,
                  top: 150 + di * (canvas.height-150)/7 + 20,
                  width: (canvas.height-150)/7 - 20,
                  height: (canvas.height-150)/7 - 20 - 20,
                  borderRadius: 20,
                });
                ctx.lineWidth = 10;
                ctx.strokeStyle = '#EEE';
                ctx.stroke(boxPath);

                ctx.fillText(`${assetInstance.name}.${assetInstance.ext}`, 300, 150 + (di+1) * (canvas.height-150)/7 - 75);
              }

              const barSize = 80;
              const numPages = Math.max(Math.ceil(unownedAssetInstances.length / 7), 1);
              ctx.fillStyle = '#CCC';
              ctx.fillRect(canvas.width - 150 + (barSize-30)/2, 150 + barSize, 30, canvas.height - 150 - barSize*2);
              if (numPages > 1) {
                ctx.fillStyle = '#ff4b4b';
                ctx.fillRect(
                  canvas.width - 150 + (barSize-30)/2, 150 + barSize + _snapToPixel(canvas.height - 150 - barSize*2, numPages, planeLeftState.barValue),
                  30, (canvas.height - 150 - barSize*2) / numPages
                );
              }
              ctx.drawImage(arrowUpImg, canvas.width - 150, 150, barSize, barSize);
              ctx.drawImage(arrowDownImg, canvas.width - 150, canvas.height - barSize, barSize, barSize);
            }

            const boxPath = _roundedRectanglePath({
              left: canvas.width - 450,
              top: 35,
              width: 300 - 30,
              height: 150 - 35*2,
              borderRadius: (150 - 35*2)/2 + 4,
            });
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#111';
            ctx.stroke(boxPath);

            ctx.fillStyle = '#111';
            ctx.font = `${fontSize}px Open sans`;
            ctx.fillText('Save world', canvas.width - 450 + (300 - 30)/2 - ctx.measureText('Save world').width/2, 150/2 + fontSize/2*0.9);

            texture.needsUpdate = true;
          };
          planeMeshLeft.render = _render;

          return planeMeshLeft;
        })();
        menuMesh.add(planeMeshLeft);
        const planeLeft = new THREE.Object3D();
        planeLeft.visible = false;
        planeLeft.position.copy(planeMeshLeft.position);
        planeLeft.quaternion.copy(planeMeshLeft.quaternion);
        planeLeft.scale.copy(planeMeshLeft.scale);
        planeLeft.updateMatrixWorld();
        planeLeft.width = WIDTH;
        planeLeft.height = HEIGHT;
        planeLeft.worldWidth = WORLD_WIDTH;
        planeLeft.worldHeight = WORLD_HEIGHT;
        planeLeft.open = false;
        planeLeft.anchors = [];
        planeLeft.updateAnchors = () => {
          const result = [];

          if (focusState.type === 'grab' && SIDES.some(side => focusState.targets[side] && focusState.targets[side].ext === 'wld')) {
            _pushAnchor(result, 50, 150 + 50, canvas.width - 50*2, canvas.height - 150 - 50*2, e => {
              const {side} = e;
              const {targets} = focusState;
              const target = targets[side];

              if (target) {
                const {items} = target.json.data;
                wallet.replaceAssets(items);

                assets = _quantizeAssets(wallet.getAssets());
                _setFocus({});
              }
            });
          } else {
            const unownedAssetInstances = wallet.getAssetInstances().filter(assetInstance => !assetInstance.owner);
            const startI = planeLeftState.page * 7;
            for (let i = startI; i < unownedAssetInstances.length; i++) {
              const di = i - startI;

              _pushAnchor(result, 0, 150 + di * (canvas.height-150)/7, canvas.width - 200, (canvas.height-150)/7, e => {
                const {side} = e;
                const target = unownedAssetInstances[i];

                if (webvr.getStatus().gamepads[side].buttons.grip.pressed) {
                  const grabbable = wallet.getAssetInstances().find(assetInstance => assetInstance.assetId === target.assetId);
                  if (grabbable.open) {
                    grabbable.setOpen(false);
                    grabbable.show();
                  }
                  grabbable.grab(side);
                } else {
                  if (target) {
                    if (focusState.type === 'leftPane' && focusState.target.assetId === target.assetId) {
                      _setFocus({});
                    } else {
                      menuState.barValue = 0;
                      menuState.page = 0;

                      _setFocus({
                        type: 'leftPane',
                        target,
                      });
                    }
                  }
                }
              });
            }

            const barSize = 80;
            const numPages = Math.ceil(unownedAssetInstances.length / 7);
            _pushAnchor(result, canvas.width - 150 + (barSize-30)/2, 150 + barSize, 30, canvas.height - 150 - barSize*2, e => {
              if (numPages > 0) {
                const {side} = e;

                onmove = () => {
                  const hoverState = uiTracker.getHoverState(side);
                  planeLeftState.barValue = Math.min(Math.max(hoverState.y - (150 + barSize), 0), canvas.height - 150 - barSize*2) / (canvas.height - 150 - barSize*2);
                  const {page: oldPage} = planeLeftState;
                  const newPage = _snapToIndex(numPages, planeLeftState.barValue);

                  if (newPage !== oldPage) {
                    planeLeftState.page = newPage;

                    planeMeshLeft.render();
                    planeLeft.updateAnchors();
                    assetsMesh.render();
                  }
                };
              }
            });
            _pushAnchor(result, canvas.width - 150, 150, barSize, barSize, e => {
              const {page: oldPage} = planeLeftState;
              const newPage = Math.max(planeLeftState.page - 1, 0);

              if (newPage !== oldPage) {
                planeLeftState.page = newPage;
                planeLeftState.barValue = planeLeftState.page / (numPages - 1);

                planeMeshLeft.render();
                planeLeft.updateAnchors();
                assetsMesh.render();
              }
            });
            _pushAnchor(result, canvas.width - 150, canvas.height - barSize, barSize, barSize, e => {
              const {page: oldPage} = planeLeftState;
              const newPage = Math.min(planeLeftState.page + 1, numPages - 1);

              if (newPage !== oldPage) {
                planeLeftState.page = newPage;
                planeLeftState.barValue = planeLeftState.page / (numPages - 1);

                planeMeshLeft.render();
                planeLeft.updateAnchors();
                assetsMesh.render();
              }
            });
          }

          _pushAnchor(result, canvas.width - 450, 35, 300 - 30, 150 - 35*2, e => {
            Promise.all([
              vrid.get('name'),
              vrid.get('assets'),
              fetch('archae/config/config.json', {
                credentials: 'include',
              })
                .then(res => res.json()),
            ])
              .then(([
                username,
                assets,
                serverConfig,
              ]) => {
                assets = assets || [];

                const {name} = serverConfig;
                const ext = 'wld';
                const assetSpec = {
                  id: _makeId(),
                  name,
                  ext,
                  json: {
                    data: {
                      items: wallet.getAssetInstances().filter(assetInstance => !assetInstance.owner).map(({
                        assetId,
                        id,
                        name,
                        ext,
                        json = null,
                        file = null,
                        owner,
                        physics,
                        visible,
                        open,
                        position,
                        rotation,
                        scale,
                      }) => ({
                        assetId,
                        id,
                        name,
                        ext,
                        json,
                        file,
                        owner,
                        physics,
                        visible,
                        open,
                        matrix: position.toArray().concat(rotation.toArray()).concat(scale.toArray()),
                      })),
                    },
                  },
                  owner: username,
                  timestamp: Date.now(),
                };
                assets.push(assetSpec);

                return vrid.set('assets', assets)
                  .then(() => assetSpec);
              })
              .then(assetSpec => {
                sfx.drop.trigger();

                planeMeshRight.render();
                planeRight.updateAnchors();
                assetsMesh.render();

                const newNotification = notification.addNotification(`Saved world to "${assetSpec.name}.${assetSpec.ext}"`);
                setTimeout(() => {
                  notification.removeNotification(newNotification);
                }, 3000);
              })
              .catch(err => {
                console.warn(err);
              });
          });

          planeLeft.anchors = result;
        };

        planeLeft.updateAnchors();
        menuMesh.add(planeLeft);
        uiTracker.addPlane(planeLeft);

        const planeMeshRight = (() => {
          const canvas = document.createElement('canvas');
          canvas.width = WIDTH;
          canvas.height = HEIGHT;
          const ctx = canvas.getContext('2d');

          const texture = new THREE.Texture(
            canvas,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.NearestFilter,
            THREE.NearestFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType
          );
          texture.needsUpdate = true;

          const planeMeshRight = _makePlaneMesh(WORLD_WIDTH, WORLD_HEIGHT, texture);
          const s = Math.sqrt(Math.pow(WORLD_WIDTH, 2) / 2);
          planeMeshRight.position.set(WORLD_WIDTH/2 + s/2, 0, s/2);
          planeMeshRight.quaternion.setFromAxisAngle(localVector.set(0, 1, 0), -Math.PI/4);
          planeMeshRight.updateMatrixWorld();

          const _render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#EEE';
            ctx.fillRect(0, 0, canvas.width, 150);

            ctx.fillStyle = '#111';
            ctx.font = `${fontSize*1.6}px Open sans`;
            ctx.fillText('Inventory', 60, fontSize*2 + 35);

            if (focusState.type === 'grab') {
              const boxPath = _roundedRectanglePath({
                left: 50,
                top: 150 + 50,
                width: canvas.width - 50*2,
                height: canvas.height - 150 - 50*2,
                borderRadius: 20,
              });
              ctx.lineWidth = 10;
              ctx.strokeStyle = '#EEE';
              ctx.stroke(boxPath);

              ctx.font = `100px Open sans`;

              ctx.fillText('Drop zone', canvas.width/2 - ctx.measureText('Drop zone').width/2, canvas.height/2 + 100/2);
            } else {
              ctx.font = `50px Open sans`;

              const assetInstances = assets;
              const startI = planeRightState.page * 7;
              for (let i = startI; i < assetInstances.length; i++) {
                const assetInstance = assetInstances[i];
                const di = i - startI;
                if (focusState.type === 'rightPane' && focusState.target.id === assetInstance.id) {
                  ctx.fillStyle = '#111';
                  ctx.fillRect(0, 150 + di * (canvas.height-150)/7, canvas.width - 200, (canvas.height-150)/7);
                  ctx.fillStyle = '#FFF';
                } else {
                  ctx.fillStyle = '#111';
                }

                const boxPath = _roundedRectanglePath({
                  left: 50,
                  top: 150 + di * (canvas.height-150)/7 + 20,
                  width: (canvas.height-150)/7 - 20,
                  height: (canvas.height-150)/7 - 20 - 20,
                  borderRadius: 20,
                });
                ctx.lineWidth = 10;
                ctx.strokeStyle = '#EEE';
                ctx.stroke(boxPath);

                ctx.fillText(`${assetInstance.name}.${assetInstance.ext}`, 300, 150 + (di+1) * (canvas.height-150)/7 - 75);
              }

              const barSize = 80;
              const numPages = Math.max(Math.ceil(assetInstances.length / 7), 1);
              ctx.fillStyle = '#CCC';
              ctx.fillRect(canvas.width - 150 + (barSize-30)/2, 150 + barSize, 30, canvas.height - 150 - barSize*2);
              if (numPages > 1) {
                ctx.fillStyle = '#ff4b4b';
                ctx.fillRect(
                  canvas.width - 150 + (barSize-30)/2, 150 + barSize + _snapToPixel(canvas.height - 150 - barSize*2, numPages, planeRightState.barValue),
                  30, (canvas.height - 150 - barSize*2) / numPages
                );
              }
              ctx.drawImage(arrowUpImg, canvas.width - 150, 150, barSize, barSize);
              ctx.drawImage(arrowDownImg, canvas.width - 150, canvas.height - barSize, barSize, barSize);
            }

            texture.needsUpdate = true;
          };
          planeMeshRight.render = _render;

          return planeMeshRight;
        })();
        menuMesh.add(planeMeshRight);
        const planeRight = new THREE.Object3D();
        planeRight.visible = false;
        planeRight.position.copy(planeMeshRight.position);
        planeRight.quaternion.copy(planeMeshRight.quaternion);
        planeRight.scale.copy(planeMeshRight.scale);
        planeRight.updateMatrixWorld();
        planeRight.width = WIDTH;
        planeRight.height = HEIGHT;
        planeRight.worldWidth = WORLD_WIDTH;
        planeRight.worldHeight = WORLD_HEIGHT;
        planeRight.open = false;
        planeRight.anchors = [];
        planeRight.updateAnchors = () => {
          const result = [];

          if (focusState.type === 'grab') {
            _pushAnchor(result, 50, 150 + 50, canvas.width - 50*2, canvas.height - 150 - 50*2, e => {
              const {side} = e;
              const {targets} = focusState;
              const target = targets[side];

              if (target) {
                wallet.storeItem(target);

                const targets = {
                  left: focusState.targets.left,
                  right: focusState.targets.right,
                };
                targets[e.side] = null;
                if (targets.left || targets.right) {
                  _setFocus({
                    type: 'grab',
                    targets,
                  });
                } else {
                  _setFocus({});
                }
              }
            });
          } else {
            const assetInstances = assets;
            const startI = planeRightState.page * 7;
            for (let i = startI; i < assetInstances.length; i++) {
              const di = i - startI;

              _pushAnchor(result, 0, 150 + di * (canvas.height-150)/7, canvas.width - 200, (canvas.height-150)/7, e => {
                const {side} = e;
                const target = assets[i];

                if (webvr.getStatus().gamepads[side].buttons.grip.pressed) {
                  wallet.pullItem(target, side);

                  planeMeshRight.render();
                  assetsMesh.render();
                } else {
                  if (target) {
                    if (focusState.type === 'rightPane' && focusState.target.id === target.id) {
                      _setFocus({});
                    } else {
                      menuState.barValue = 0;
                      menuState.page = 0;

                      _setFocus({
                        type: 'rightPane',
                        target,
                      });
                    }
                  }
                }
              });
            }

            const barSize = 80;
            const numPages = Math.ceil(assetInstances.length / 7);
            _pushAnchor(result, canvas.width - 150 + (barSize-30)/2, 150 + barSize, 30, canvas.height - 150 - barSize*2, e => {
              if (numPages > 0) {
                const {side} = e;

                onmove = () => {
                  const hoverState = uiTracker.getHoverState(side);
                  planeRightState.barValue = Math.min(Math.max(hoverState.y - (150 + barSize), 0), canvas.height - 150 - barSize*2) / (canvas.height - 150 - barSize*2);
                  const {page: oldPage} = planeRightState;
                  const newPage = _snapToIndex(numPages, planeRightState.barValue);

                  if (newPage !== oldPage) {
                    planeRightState.page = newPage;

                    planeMeshRight.render();
                    planeRight.updateAnchors();
                    assetsMesh.render();
                  }
                };
              }
            });
            _pushAnchor(result, canvas.width - 150, 150, barSize, barSize, e => {
              const {page: oldPage} = planeRightState;
              const newPage = Math.max(planeRightState.page - 1, 0);

              if (newPage !== oldPage) {
                planeRightState.page = newPage;
                planeRightState.barValue = planeRightState.page / (numPages - 1);

                planeMeshRight.render();
                planeRight.updateAnchors();
                assetsMesh.render();
              }
            });
            _pushAnchor(result, canvas.width - 150, canvas.height - barSize, barSize, barSize, e => {
              const {page: oldPage} = planeRightState;
              const newPage = Math.min(planeRightState.page + 1, numPages - 1);

              if (newPage !== oldPage) {
                planeRightState.page = newPage;
                planeRightState.barValue = planeRightState.page / (numPages - 1);

                planeMeshRight.render();
                planeRight.updateAnchors();
                assetsMesh.render();
              }
            });
          }

          planeRight.anchors = result;
        };
        planeRight.updateAnchors();
        menuMesh.add(planeRight);
        uiTracker.addPlane(planeRight);

        const {dotMeshes, boxMeshes} = uiTracker;
        for (let i = 0; i < SIDES.length; i++) {
          const side = SIDES[i];
          scene.add(dotMeshes[side]);
          scene.add(boxMeshes[side]);
        }

        (() => {
          const assetInstances = wallet.getAssetInstances();
          for (let i = 0; i < assetInstances.length; i++) {
            const assetInstance = assetInstances[i];
            if (assetInstance.open) {
              _openAssetInstance(assetInstance);
            }
          }
        })();

        const assetsMesh = (() => {
          const geometry = (() => {
            const geometry = new THREE.BufferGeometry();

            geometry.boundingSphere = new THREE.Sphere(
              zeroVector,
              1
            );
            const cleanups = [];
            geometry.destroy = () => {
              for (let i = 0; i < cleanups.length; i++) {
                cleanups[i]();
              }
            };

            return geometry;
          })();
          const material = assetsMaterial;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.frustumCulled = false;
          const _renderAssets = _debounce(next => {
            // const s = Math.sqrt(Math.pow(WORLD_WIDTH, 2) / 2);
            const _renderAssetMesh = matrix => (assetSpec, i) => {
                const _requestAssetImageData = () => {
                  const type = _normalizeType(assetSpec.ext);
                  if (type === 'itm') {
                    if (assetSpec.json && assetSpec.json.data && assetSpec.json.data.icon && typeof assetSpec.json.data.icon === 'string') {
                      return _requestImageData('data:application/octet-stream;base64,' + assetSpec.json.data.icon);
                    } else {
                      return Promise.resolve(_cloneImageData(fileImgData));
                    }
                  } else if (type === 'med') {
                    if (isImageType(assetSpec.ext)) {
                      return Promise.resolve(_cloneImageData(imageImgData));
                    } else if (isAudioType(assetSpec.ext)) {
                      return Promise.resolve(_cloneImageData(audioImgData));
                    } else if (isVideoType(assetSpec.ext)) {
                      return Promise.resolve(_cloneImageData(videoImgData));
                    } else if (isModelType(assetSpec.ext)) {
                      return Promise.resolve(_cloneImageData(modelImgData));
                    } else {
                      return Promise.resolve(_cloneImageData(fileImgData));
                    }
                  } else {
                    return Promise.resolve(_cloneImageData(fileImgData));
                  }
                };
                return _requestAssetImageData()
                  .then(imageData => spriteUtils.requestSpriteGeometry(imageData, pixelSize, localMatrix.compose(
                    localVector.set(
                      -WORLD_WIDTH/2 + (50 + (canvas.height-150)/7/2) * WORLD_WIDTH/WIDTH,
                      WORLD_HEIGHT/2 - (150 + (i + 0.5) * (canvas.height-150)/7) * WORLD_HEIGHT/HEIGHT,
                      pixelSize*16/2
                    )
                      .applyMatrix4(matrix),
                    zeroQuaternion,
                    oneVector
                  )));
              };

            const promises =
              ((focusState.type === 'grab' && SIDES.some(side => focusState.targets[side] && focusState.targets[side].ext === 'wld')) ?
                  []
                :
                  wallet.getAssetInstances()
                    .filter(assetInstance => !assetInstance.owner)
                    .slice(planeLeftState.page * 7, (planeLeftState.page+1) * 7)
                    .map(_renderAssetMesh(planeLeft.matrix))
              )
                .concat(
                  focusState.type === 'grab' ?
                    []
                  :
                    assets
                      .slice(planeRightState.page * 7, (planeRightState.page+1) * 7)
                      .map(_renderAssetMesh(planeRight.matrix))
                );

            Promise.all(promises)
              .then(geometrySpecs => {
                const positions = new Float32Array(NUM_POSITIONS);
                const colors = new Float32Array(NUM_POSITIONS);
                const dys = new Float32Array(NUM_POSITIONS);

                let attributeIndex = 0;
                let dyIndex = 0;

                for (let i = 0; i < geometrySpecs.length; i++) {
                  const geometrySpec = geometrySpecs[i];
                  const {positions: newPositions, colors: newColors, dys: newDys} = geometrySpec;

                  positions.set(newPositions, attributeIndex);
                  colors.set(newColors, attributeIndex);
                  dys.set(newDys, dyIndex);

                  attributeIndex += newPositions.length;
                  dyIndex += newDys.length;

                  spriteUtils.releaseSpriteGeometry(geometrySpec);
                }

                geometry.addAttribute('position', new THREE.BufferAttribute(positions.subarray(0, attributeIndex), 3));
                geometry.addAttribute('color', new THREE.BufferAttribute(colors.subarray(0, attributeIndex), 3));
                geometry.addAttribute('dy', new THREE.BufferAttribute(dys.subarray(0, dyIndex), 2));

                next();
              })
              .catch(err => {
                console.warn(err);

                next();
              });
          });
          _renderAssets();
          mesh.render = _renderAssets;
          return mesh;
        })();
        menuMesh.add(assetsMesh);

        let animation = null;
        const _openMenu = () => {
          const {hmd: hmdStatus} = webvr.getStatus();
          const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;

          const newMenuRotation = (() => {
            const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
            hmdEuler.x = 0;
            hmdEuler.z = 0;
            return new THREE.Quaternion().setFromEuler(hmdEuler);
          })();
          const newMenuPosition = hmdPosition.clone()
            .add(new THREE.Vector3(0, 0, -1.5).applyQuaternion(newMenuRotation));
          const newMenuScale = new THREE.Vector3(1, 1, 1);
          menuMesh.position.copy(newMenuPosition);
          menuMesh.quaternion.copy(newMenuRotation);
          menuMesh.scale.copy(newMenuScale);
          // menuMesh.visible = true;
          menuMesh.updateMatrixWorld();

          menuState.open = true;
          /* menuState.position.copy(newMenuPosition);
          menuState.rotation.copy(newMenuRotation);
          menuState.scale.copy(newMenuScale); */
          plane.open = true;
          planeLeft.open = true;
          planeRight.open = true;

          planeMeshLeft.render();
          planeLeft.updateAnchors();
          planeMeshRight.render();
          planeRight.updateAnchors();

          sfx.digi_slide.trigger();

          animation = anima.makeAnimation(0, 1, 1000);
        };
        const _closeMenu = () => {
          menuState.open = false;
          plane.open = false;
          planeLeft.open = false;
          planeRight.open = false;

          sfx.digi_powerdown.trigger();

          animation = anima.makeAnimation(1, 0, 1000);
        };
        const _menudown2 = () => {
          const {open} = menuState;

          if (open) {
            _closeMenu();
          } else {
            _openMenu();
          }
        };
        input.on('menudown', _menudown2);

        const _triggerdown = e => {
          const {side} = e;

          if (menuState.open) {
            const hoverState = uiTracker.getHoverState(side);
            const {anchor} = hoverState;
            if (anchor) {
              anchor.triggerdown(e, hoverState);
            }
          } else {
            const grabbable = hand.getGrabbedGrabbable(side);
            const {ext} = grabbable;

            if (_normalizeType(ext) === 'med') {
              grabbable.setOpen(true);
              grabbable.hide();
              grabbable.disablePhysics();
            }
          }
        };
        input.on('triggerdown', _triggerdown);
        const _triggerup = e => {
          onmove = null;
        };
        input.on('triggerup', _triggerup);

        const _trigger = e => {
          const {side} = e;

          if (menuState.open) {
            sfx.digi_plink.trigger();

            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger, {
          priority: -1,
        });

        const _isItemHovered = side => {
          const assetPosition = localVector.copy(zeroVector)
            .applyMatrix4(
              localMatrix.compose(
                localVector2.set(
                  WORLD_WIDTH / 2 - pixelSize * 16 - pixelSize * 16*0.75,
                  -WORLD_HEIGHT / 2 + pixelSize * 16,
                  pixelSize * 16/2
                ),
                zeroQuaternion,
                oneVector
              ).premultiply(assetsMesh.matrixWorld)
            );
          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads[side];
          const distance = assetPosition.distanceTo(gamepad.worldPosition);
          return distance < pixelSize*16/2;
        };

        const _grab = e => {
          const targets = focusState.type === 'grab' ? focusState.targets : {
            left: null,
            right: null,
          };
          targets[e.side] = e.grabbable;

          _setFocus({
            type: 'grab',
            targets,
          });
        };
        hand.on('grab', _grab);
        const _release = e => {
          const targets = {
            left: focusState.targets.left,
            right: focusState.targets.right,
          };
          targets[e.side] = null;
          if (targets.left || targets.right) {
            _setFocus({
              type: 'grab',
              targets,
            });
          } else {
            _setFocus({});
          }
        };
        hand.on('release', _release);

        cleanups.push(() => {
          scene.remove(menuMesh);

          for (let i = 0; i < SIDES.length; i++) {
            const side = SIDES[i];
            scene.remove(uiTracker.dotMeshes[side]);
            scene.remove(uiTracker.boxMeshes[side]);
          }

          world.removeListener('add', _worldAdd);
          wallet.removeListener('assets', _walletAssets);

          wallet.removeListener('menuopen', _openAssetInstance);
          wallet.removeListener('menuclose', _closeAssetInstance);

          input.removeListener('menudown', _menudown2);
          input.removeListener('triggerdown', _triggerdown);
          input.removeListener('triggerup', _trigger);
          hand.removeListener('grab', _grab);
          hand.removeListener('release', _release);

          scene.onRenderEye = null;
          scene.onBeforeRenderEye = null;
          scene.onAfterRenderEye = null;
        });

        rend.on('update', () => {
          const _updateMove = () => {
            if (onmove) {
              onmove();
            }
          };
          const _updateMenu = () => {
            if (menuState.open) {
              if (menuMesh.position.distanceTo(webvr.getStatus().hmd.worldPosition) > MENU_RANGE) {
                _closeMenu();
              }
            }
          };
          const _updateUiTracker = () => {
            uiTracker.update({
              pose: webvr.getStatus(),
              sides: (() => {
                const vrMode = bootstrap.getVrMode();

                if (vrMode === 'hmd') {
                  return SIDES;
                } else {
                  const mode = webvr.getMode();

                  if (mode !== 'center') {
                    return [mode];
                  } else {
                    return SIDES;
                  }
                }
              })(),
              controllerMeshes: rend.getAuxObject('controllerMeshes'),
            });
          };
          const _updateAnimation = () => {
            if (animation) {
              if (animation.isDone()) {
                menuMesh.visible = animation.getValue() >= 0.5;
                animation = null;
              } else {
                const value = animation.getValue();
                if (value > 0) {
                  planeMesh.scale.set(1, value, 1);
                  planeMesh.updateMatrixWorld();

                  planeMeshLeft.scale.set(1, value, 1);
                  planeMeshLeft.updateMatrixWorld();

                  planeMeshRight.scale.set(1, value, 1);
                  planeMeshRight.updateMatrixWorld();

                  assetsMesh.scale.set(1, value, 1);
                  assetsMesh.updateMatrixWorld();

                  // lensMesh.scale.set(value, value, value);
                  // lensMesh.updateMatrixWorld();
                  // lensMesh.planeMesh.material.uniforms.opacity.value = value;

                  menuMesh.visible = true;
                } else {
                  menuMesh.visible = false;
                }
              }
            }
          };

          _updateMove();
          _updateMenu();
          _updateUiTracker();
          _updateAnimation();
        });
        /* rend.on('updateEye', eyeCamera => {
          if (menuMesh.visible) {
            lensMesh.planeMesh.visible = false;
            lensMesh.render(scene, eyeCamera);
            lensMesh.planeMesh.visible = true;
          }
        }); */
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}
const _clone = o => {
  const result = {};
  for (const k in o) {
    result[k] = o[k];
  }
  return result;
};
const _makeId = () => Math.random().toString(36).substring(7);
const _roundToDecimals = (value, decimals) => Number(Math.round(value+'e'+decimals)+'e-'+decimals);
const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = Inventory;
