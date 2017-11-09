const EffectComposer = require('./lib/three-extra/postprocessing/EffectComposer');
const BlurShader = require('./lib/three-extra/shaders/BlurShader');
const {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} = require('./lib/constants/menu');

const NUM_POSITIONS = 500 * 1024;
const MENU_RANGE = 3;
const SIDES = ['left', 'right'];

const width = 0.1;
const height = 0.1;
const pixelWidth = 128;
const pixelHeight = 128;

const LENS_SHADER = {
  uniforms: {
    textureMap: {
      type: 't',
      value: null,
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
    "varying vec4 texCoord;",
    "void main() {",
    "  vec4 diffuse = texture2DProj(textureMap, texCoord);",
    "  gl_FragColor = vec4(mix(diffuse.rgb, vec3(0, 0, 0), 0.5), diffuse.a);",
    "}"
  ].join("\n")
};

class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        site: {
          url: siteUrl,
        },
        server: {
          enabled: serverEnabled,
        },
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

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });
    const _requestImageBitmap = src => _requestImage(src)
      .then(img => createImageBitmap(img, 0, 0, img.width, img.height));

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/resource',
        '/core/utils/js-utils',
        '/core/utils/geometry-utils',
        '/core/utils/hash-utils',
        '/core/utils/sprite-utils',
        '/core/utils/vrid-utils',
      ]),
      _requestImageBitmap('/archae/rend/img/menu.svg'),
    ]).then(([
      [
        bootstrap,
        input,
        three,
        webvr,
        biolumi,
        resource,
        jsUtils,
        geometryUtils,
        hashUtils,
        spriteUtils,
        vridUtils,
      ],
      menuImg,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {murmur} = hashUtils;
        const {materials: {assets: assetsMaterial}, sfx} = resource;
        const {vridApi} = vridUtils;

        const THREEEffectComposer = EffectComposer(THREE);
        const {THREERenderPass, THREEShaderPass} = THREEEffectComposer;
        const THREEBlurShader = BlurShader(THREE);

        return vridApi.get('assets')
          .then(assets => {
            if (live) {
              const _quantizeAssets = assets => {
                const assetIndex = {};
                for (let i = 0; i < assets.length; i++) {
                  const assetSpec = assets[i];
                  const {asset} = assetSpec;
                  let entry = assetIndex[asset];
                  if (!entry) {
                    entry = _clone(assetSpec);
                    entry.assets = [];
                    assetIndex[asset] = entry;
                  }
                  entry.assets.push(assetSpec);
                }
                return Object.keys(assetIndex).map(k => assetIndex[k]);
              };
              // assets = _quantizeAssets(assets || []);
              assets = _quantizeAssets(assets || []);

              const localVector = new THREE.Vector3();
              const localMatrix = new THREE.Matrix4();
              const zeroQuaternion = new THREE.Quaternion();
              const oneVector = new THREE.Vector3(1, 1, 1);
              const zeroArray = new Float32Array(0);
              const zeroArray2 = new Float32Array(0);
              const zeroVector = new THREE.Vector3();
              const pixelSize = 0.006;

              const _getAssetType = asset => {
                const match = asset.match(/^(ITEM|MOD|SKIN|FILE)\.(.+)$/);
                const type = match[1].toLowerCase();
                const name = match[2].toLowerCase();
                return {type, name};
              };
              const _requestAssetImageData = asset => (() => {
                const {type, name} = _getAssetType(asset);
                if (type === 'item') {
                  return resource.getItemImageData(name);
                } else if (type === 'mod') {
                  return resource.getModImageData(name);
                } else if (type === 'file') {
                  return resource.getFileImageData(name);
                } else if (type === 'skin') {
                  return resource.getSkinImageData(name);
                } else {
                  return Promise.resolve(null);
                }
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

              const auxObjects = {
                controllerMeshes: null,
              };

              const uiTracker = biolumi.makeUiTracker();

              const statusState = {
                state: 'connecting',
                url: '',
                address: '',
                port: 0,
                username: '',
                users: [],
              };
              const menuState = {
                open: false,
                position: new THREE.Vector3(0, DEFAULT_USER_HEIGHT, -1.5),
                rotation: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
              };

              const canvas = document.createElement('canvas');
              canvas.width = WIDTH;
              canvas.height = HEIGHT;
              const ctx = canvas.getContext('2d');
              ctx.font = '600 13px Open sans';
              ctx.fillStyle = '#FFF';
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

              const _getLocalTabAssets = () => assets
                .filter(assetSpec => _getAssetType(assetSpec.asset).type === tabType);
              const _getLocalAssets = () => _getLocalTabAssets()
                .slice(inventoryPage * 12, (inventoryPage + 1) * 12);

              let tabIndex = 0;
              let tabType = 'item';
              let inventoryPage = 0;
              let localAssets = _getLocalAssets();
              const localTabAssets = _getLocalTabAssets();
              let inventoryPages = localTabAssets.length > 12 ? Math.ceil(localTabAssets.length / 12) : 0;
              let inventoryBarValue = 0;
              let equipmentPages = 2; // XXX
              let equipmentBarValue = 0;
              const _snapToIndex = (steps, value) => Math.floor(steps * value);
              const _snapToPixel = (max, steps, value) => {
                const stepIndex = _snapToIndex(steps, value);
                const stepSize = max / steps;
                return stepIndex * stepSize;
              };
              const _renderMenu = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(menuImg, (canvas.width - menuImg.width) / 2, (canvas.height - menuImg.height) / 2, canvas.width, canvas.width * menuImg.height / menuImg.width);
                ctx.fillRect(850 + tabIndex * 126, 212, 125, 4);
                ctx.fillRect(1316, 235 + _snapToPixel(600, inventoryPages, inventoryBarValue), 24, 600 / inventoryPages);
                ctx.fillRect(456, 204 + _snapToPixel(600, equipmentPages, equipmentBarValue), 24, 600 / equipmentPages);
                texture.needsUpdate = true;
              };
              _renderMenu();

              const menuMesh = (() => {
                const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);
                const material = new THREE.MeshBasicMaterial({
                  map: texture,
                  side: THREE.DoubleSide,
                  transparent: true,
                  // renderOrder: -1,
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.visible = false;
                return mesh;
              })();
              scene.add(menuMesh);

              const {dotMeshes, boxMeshes} = uiTracker;
              for (let i = 0; i < SIDES.length; i++) {
                const side = SIDES[i];
                scene.add(dotMeshes[side]);
                scene.add(boxMeshes[side]);
              }

              const plane = new THREE.Object3D();
              plane.width = WIDTH;
              plane.height = HEIGHT;
              plane.worldWidth = WORLD_WIDTH;
              plane.worldHeight = WORLD_HEIGHT;
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
              let ontriggerup = null;
              const inventoryAnchors = [];
              let index = 0;
              for (let dx = 0; dx < 3; dx++) {
                for (let dy = 0; dy < 4; dy++) {
                  const localIndex = index++;
                  _pushAnchor(inventoryAnchors, 870 + dx * 150, 235 + dy * 155, 132, 132, e => {
                    console.log('inventory', localIndex);

                    e.stopImmediatePropagation();
                  });
                }
              }
              const inventoryBarAnchors = [];
              _pushAnchor(inventoryBarAnchors, 1316, 235, 24, 600, (e, hoverState) => {
                const {side} = e;

                let lastInventoryPage = -1;
                const _renderAssets = () => {
                  inventoryPage = _snapToIndex(inventoryPages, inventoryBarValue);
                  if (inventoryPage !== lastInventoryPage) {
                    localAssets = _getLocalAssets();

                    assetsMesh.render();
                    lastInventoryPage = inventoryPage;
                  }
                };

                inventoryBarValue = hoverState.crossValue;
                _renderMenu();
                _renderAssets();

                onmove = () => {
                  const hoverState = uiTracker.getHoverState(side);
                  inventoryBarValue = Math.min(Math.max(hoverState.y - 235, 0), 600) / 600;
                  _renderMenu();
                  _renderAssets();
                };
                ontriggerup = e => {
                  console.log('inventory bar trigger up');
                };
              });
              index = 0;
              const equipmentAnchors = [];
              for (let dy = 0; dy < 4; dy++) {
                const localIndex = index++;
                _pushAnchor(equipmentAnchors, 576, 235 + dy * 152, 252, 120, e => {
                  console.log('equipment', localIndex);

                  e.stopImmediatePropagation();
                });
              }
              index = 0;
              const tabsAnchors = [];
              for (let dx = 0; dx < 4; dx++) {
                const localIndex = index++;
                _pushAnchor(tabsAnchors, 850 + dx * 126, 160, 126, 60, e => {
                  tabIndex = localIndex;
                  if (tabIndex === 0) {
                    tabType = 'item';
                  } else if (tabIndex === 1) {
                    tabType = 'mod';
                  } else if (tabIndex === 2) {
                    tabType = 'file';
                  } else if (tabIndex === 3) {
                    tabType = 'skin';
                  }
                  localAssets = _getLocalAssets();
                  const localTabAssets = _getLocalTabAssets();
                  inventoryPages = localTabAssets.length > 12 ? Math.ceil(localTabAssets.length / 12) : 0;

                  _renderMenu();
                  assetsMesh.render();

                  e.stopImmediatePropagation();
                });
              }
              index = 0;
              const serverAnchors = [];
              for (let dx = 0; dx < 3; dx++) {
                for (let dy = 0; dy < 4; dy++) {
                  const localIndex = index++;
                  _pushAnchor(serverAnchors, dx * 150, 204 + dy * 155, 132, 132, e => {
                    console.log('server', localIndex);

                    e.stopImmediatePropagation();
                  });
                }
              }
              const serverBarAnchors = [];
              _pushAnchor(serverBarAnchors, 456, 204, 24, 600, (e, hoverState) => {
                const {side} = e;

                equipmentBarValue = hoverState.crossValue;
                _renderMenu();

                onmove = () => {
                  const hoverState = uiTracker.getHoverState(side);
                  equipmentBarValue = Math.min(Math.max(hoverState.y - 204, 0), 600) / 600;
                  _renderMenu();
                };
                ontriggerup = e => {
                  console.log('server bar trigger up');
                };
              });
              plane.anchors = inventoryAnchors.concat(inventoryBarAnchors).concat(equipmentAnchors).concat(tabsAnchors).concat(serverAnchors).concat(serverBarAnchors);
              menuMesh.add(plane);
              uiTracker.addPlane(plane);

              const lensMesh = (() => {
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
              menuMesh.add(lensMesh);

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
                const material = assetsMaterial; // XXX move this to resource engine
                const mesh = new THREE.Mesh(geometry, material);
                const _renderAssets = () => {
                  Promise.all(
                    localAssets
                      .map((assetSpec, i) =>
                        _requestAssetImageData(assetSpec.asset)
                          .then(imageData => spriteUtils.requestSpriteGeometry(imageData, pixelSize, localMatrix.compose(
                            localVector.set(
                              WORLD_WIDTH * -0.01 + (i % 3) * WORLD_WIDTH * 0.065 * 1.2,
                              WORLD_HEIGHT * 0.18 -Math.floor(i / 3) * WORLD_WIDTH * 0.065 * 1.2,
                              pixelSize * 16 * 0.6
                            ),
                            zeroQuaternion,
                            oneVector
                          )))
                      )
                  )
                  .then(geometrySpecs => {
                    if (live) {
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

                        cleanups.push(() => {
                          spriteUtils.releaseSpriteGeometry(geometrySpec);
                        });
                      }

                      geometry.addAttribute('position', new THREE.BufferAttribute(positions.subarray(0, attributeIndex), 3));
                      geometry.addAttribute('color', new THREE.BufferAttribute(colors.subarray(0, attributeIndex), 3));
                      geometry.addAttribute('dy', new THREE.BufferAttribute(dys.subarray(0, dyIndex), 2));
                    }
                  })
                  .catch(err => {
                    if (live) {
                      console.warn(err);
                    }
                  });
                };
                _renderAssets();
                mesh.render = _renderAssets;
                return mesh;
              })();
              menuMesh.add(assetsMesh);

              const trigger = e => {
                const {side} = e;

                if (menuState.open) {
                  sfx.digi_plink.trigger();

                  e.stopImmediatePropagation();
                }
              };
              input.on('trigger', trigger, {
                priority: -1,
              });

              const _closeMenu = () => {
                menuMesh.visible = false;

                menuState.open = false; // XXX need to cancel other menu states as well

                uiTracker.setOpen(false);

                sfx.digi_powerdown.trigger();

                rendApi.emit('close');
              };
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
                menuMesh.visible = true;
                menuMesh.updateMatrixWorld();

                menuState.open = true;
                menuState.position.copy(newMenuPosition);
                menuState.rotation.copy(newMenuRotation);
                menuState.scale.copy(newMenuScale);

                uiTracker.setOpen(true);

                sfx.digi_slide.trigger();

                rendApi.emit('open', {
                  position: newMenuPosition,
                  rotation: newMenuRotation,
                  scale: newMenuScale,
                });
              };
              const _menudown = () => {
                const {open} = menuState;

                if (open) {
                  _closeMenu();
                } else {
                  _openMenu();
                }
              };
              input.on('menudown', _menudown);

              scene.onBeforeRender = () => {
                rendApi.emit('beforeRender');
              };
              scene.onAfterRender = () => {
                rendApi.emit('afterRender');
              };
              scene.onRenderEye = camera => {
                rendApi.emit('updateEye', camera);
              };
              scene.onBeforeRenderEye = () => {
                rendApi.emit('updateEyeStart');
              };
              scene.onAfterRenderEye = () => {
                rendApi.emit('updateEyeEnd');
              };

              const _triggerdown = e => {
                const {side} = e;
                const hoverState = uiTracker.getHoverState(side);
                const {anchor} = hoverState;
                if (anchor) {
                  anchor.triggerdown(e, hoverState);
                }
              };
              input.on('triggerdown', _triggerdown);
              const _triggerup = e => {
                if (ontriggerup) {
                  ontriggerup(e);
                }
                onmove = null;
                ontriggerup = null;
              };
              input.on('triggerup', _triggerup);

              cleanups.push(() => {
                scene.remove(menuMesh);

                for (let i = 0; i < SIDES.length; i++) {
                  const side = SIDES[i];
                  scene.remove(uiTracker.dotMeshes[side]);
                  scene.remove(uiTracker.boxMeshes[side]);
                }

                input.removeListener('triggerdown', _triggerdown);
                input.removeListener('triggerup', _triggerup);
                input.removeListener('menudown', _menudown);

                scene.onRenderEye = null;
                scene.onBeforeRenderEye = null;
                scene.onAfterRenderEye = null;
              });

              class RendApi extends EventEmitter {
                constructor() {
                  super();

                  this.setMaxListeners(100);
                }

                isOpen() {
                  return menuState.open;
                }

                getMenuState() {
                  return menuState;
                }

                getMenuMesh() {
                  return menuMesh;
                }

                getStatus(name) {
                  return statusState[name];
                }

                setStatus(name, value) {
                  statusState[name] = value;
                }

                registerAuxObject(name, object) {
                  auxObjects[name] = object;
                }

                update() {
                  this.emit('update');
                }

                updateStart() {
                  this.emit('updateStart');
                }

                updateEnd() {
                  this.emit('updateEnd');
                }

                grab(options) {
                  this.emit('grab', options);
                }

                release(options) {
                  this.emit('release', options);
                }

                setEntity(item) {
                  this.emit('entitychange', item);
                }

                addPlane(plane) {
                  uiTracker.addPlane(plane);
                }

                removePage(page) {
                  uiTracker.removePage(page);
                }

                loadEntities(itemSpecs) {
                  this.emit('loadEntities', itemSpecs);
                }

                saveAllEntities() {
                  this.emit('saveAllEntities');
                }

                clearAllEntities() {
                  this.emit('clearAllEntities');
                }

                getHoverState(side) {
                  return uiTracker.getHoverState(side);
                }
              }
              const rendApi = new RendApi();
              rendApi.on('update', () => {
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
                    controllerMeshes: auxObjects.controllerMeshes,
                  });
                };

                _updateMove();
                _updateMenu();
                _updateUiTracker();
              });
              rendApi.on('updateEye', eyeCamera => {
                lensMesh.planeMesh.visible = false;
                lensMesh.render(scene, eyeCamera);
                lensMesh.planeMesh.visible = true;
              });

              return rendApi;
            }
          });
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

module.exports = Rend;
