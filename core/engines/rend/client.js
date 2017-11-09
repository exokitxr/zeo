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

const NUM_POSITIONS = 200 * 1024;
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

        const zeroArray = new Float32Array(0);
        const zeroArray2 = new Float32Array(0);
        const zeroVector = new THREE.Vector3();
        const pixelSize = 0.015;

        const _requestAssets = () => vridApi.get('assets')
          .then(assets => assets || []);
        const _requestAssetImageData = asset => (() => {
          const match = asset.match(/^(ITEM|MOD|SKIN|FILE)\.(.+)$/);
          const type = match[1];
          const name = match[2];
          if (type === 'ITEM') {
            return resource.getItemImageData(name);
          } else if (type === 'MOD') {
            return resource.getModImageData(name);
          } else if (type === 'FILE') {
            return resource.getFileImageData(name);
          } else if (type === 'SKIN') {
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

        let tabIndex = 0;
        const _render = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(menuImg, (canvas.width - menuImg.width) / 2, (canvas.height - menuImg.height) / 2, canvas.width, canvas.width * menuImg.height / menuImg.width);
          ctx.fillRect(850 + tabIndex * 126, 212, 125, 4);
          texture.needsUpdate = true
        };
        _render();

        const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
          for (let i = 0; i < src.length; i++) {
            dst[startIndexIndex + i] = src[i] + startAttributeIndex;
          }
        }

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
          console.log('inventory bar', hoverState.value, hoverState.crossValue);

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
            _render();

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
          console.log('server bar', hoverState.value, hoverState.crossValue);

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
            _requestAssets()
              .then(assets => {
                if (assets.length > 0) {
                  _requestAssetImageData(assets[0].asset)
                    .then(imageData => spriteUtils.requestSpriteGeometry(imageData, pixelSize))
                    .then(geometrySpec => {
                      if (live) {
                        const {positions, normals, colors, dys, zeroDys} = geometrySpec;

                        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                        // geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
                        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
                        geometry.addAttribute('dy', new THREE.BufferAttribute(geometry.getAttribute('dy').array === geometry.dys ? dys : zeroDys, 2));

                        geometry.dys = dys;
                        geometry.zeroDys = zeroDys;

                        geometry.destroy = function() {
                          this.dispose();
                          spriteUtils.releaseSpriteGeometry(geometrySpec);
                        };
                      }
                    })
                    .catch(err => {
                      if (live) {
                        console.warn(err);
                      }
                    });
                }
              });

            const geometry = new THREE.BufferGeometry();
            const dys = zeroArray; // two of these so we can tell which is active
            const zeroDys = zeroArray2;
            geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 2));
            geometry.dys = dys;
            geometry.zeroDys = zeroDys;
            geometry.boundingSphere = new THREE.Sphere(
              zeroVector,
              1
            );
            geometry.destroy = function() {
              this.dispose();
            };
            return geometry;
          })();
          const material = assetsMaterial; // XXX move this to resource engine
          const mesh = new THREE.Mesh(geometry, material);
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
            ontriggerup = null;
          }
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

  unmount() {
    this._cleanup();
  }
}

module.exports = Rend;
