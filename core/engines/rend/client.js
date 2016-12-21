const heredoc = require('heredoc');
const showdown = require('showdown');
const showdownConverter = new showdown.Converter();

const WIDTH = 2 * 1024;
const HEIGHT = WIDTH / 1.5;
const ASPECT_RATIO = WIDTH / HEIGHT;

const MENU_SIZE = 2;
const WORLD_WIDTH = MENU_SIZE;
const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;
const WORLD_DEPTH = MENU_SIZE / 50;

class Rend {
  constructor(archae) {
    this._archae = archae;

    this.updates = [];
    this.updateEyes = [];
  }

  mount() {
    const {_archae: archae, updates, updateEyes} = this;

    let live = true;
    const cleanups = [];
    this._cleanup = () => {
      live = false;

      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    return Promise.all([
      archae.requestEngines([
        '/core/engines/three',
        '/core/engines/biolumi',
        '/core/engines/bullet',
        '/core/engines/heartlink',
      ]),
      archae.requestPlugins([
        '/core/plugins/creature-utils',
      ]),
    ]).then(([
      [three, biolumi, bullet, heartlink],
      [creatureUtils],
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const fonts = biolumi.getFonts();
        const fontWeight = biolumi.getFontWeight();
        const transparentImg = biolumi.getTransparentImg();
        const maxNumTextures = biolumi.getMaxNumTextures();

        const worlds = new Map();
        let currentWorld = null;
        const mods = new Map();
        let currentMods = null;

        cleanups.push(() => {
          worlds.forEach(world => {
            world.destroy();
          });
        });

        const _getCurrentWorld = () => currentWorld;
        const _requestChangeWorld = worldName => new Promise((accept, reject) => {
          const world = worlds.get(worldName);

          if (world) {
            currentWorld = world;
            currentMods = mods.get(worldName);

            accept();
          } else {
            const _requestModsStatus = worldName => fetch('/archae/rend/mods/status', {
              method: 'POST',
              headers: (() => {
                const headers = new Headers();
                headers.set('Content-Type', 'application/json');
                return headers;
              })(),
              body: JSON.stringify({
                world: worldName,
              }),
            }).then(res => res.json());

            Promise.all([
              _requestModsStatus(worldName),
              bullet.requestWorld(worldName),
            ])
              .then(([
                modsStatus,
                physics,
              ]) => {
                const player = heartlink.getPlayer(); // XXX make this per-world

                // plugin managemnent
                const plugins = new Map();

                const startTime = Date.now();
                let worldTime = 0;
                const _addUpdate = update => {
                  updates.push(update);
                };
                const _addUpdateEye = updateEye => {
                  updateEyes.push(updateEye);
                };

                _addUpdate(() => {
                  // update state
                  const now = Date.now();
                  worldTime = now - startTime;

                  // update plugins
                  plugins.forEach(plugin => {
                    if (typeof plugin.update === 'function') {
                      plugin.update();
                    }
                  });
                });
                _addUpdateEye(camera => {
                  // update plugins per eye
                  plugins.forEach(plugin => {
                    if (typeof plugin.updateEye === 'function') {
                      plugin.updateEye(camera);
                    }
                  });
                });

                const _getWorldTime = () => worldTime;
                const _requestAddMod = mod => fetch('/archae/rend/mods/add', {
                  method: 'POST',
                  headers: (() => {
                    const headers = new Headers();
                    headers.set('Content-Type', 'application/json');
                    return headers;
                  })(),
                  body: JSON.stringify({
                    world: worldName,
                    mod: mod,
                  }),
                }).then(res => res.text()
                  .then(() => {
                    const m = modsStatus.find(m => m.name === mod);
                    m.installed = true;
                  })
                  .then(() => _requestMod('/extra/plugins/zeo/' + mod))
                );
                const _requestAddMods = mods => Promise.all(mods.map(_requestAddMod));
                const _requestMod = mod => archae.requestPlugin(mod)
                  .then(plugin => {
                    const pluginName = archae.getName(plugin);
                    plugins.set(pluginName, plugin);

                    return plugin;
                  });
                const _requestMods = mods => Promise.all(mods.map(_requestMod));
                const _requestRemoveMod = mod => fetch('/archae/rend/mods/remove', {
                  method: 'POST',
                  headers: (() => {
                    const headers = new Headers();
                    headers.set('Content-Type', 'application/json');
                    return headers;
                  })(),
                  body: JSON.stringify({
                    world: worldName,
                    mod: mod,
                  }),
                }).then(res => res.text()
                  .then(() => {
                    const m = modsStatus.find(m => m.name === mod);
                    m.installed = false;
                  })
                  .then(() => _requestReleaseMod('/extra/plugins/zeo/' + mod))
                );
                const _requestRemoveMods = mods => Promise.all(mods.map(_requestRemoveMod));
                const _requestReleaseMod = mod => archae.releasePlugin(mod)
                  .then(plugin => {
                    const pluginName = archae.getName(plugin);
                    plugins.delete(pluginName);

                    return plugin;
                  });
                const _requestReleaseMods = mods => Promise.all(mods.map(_requestReleaseMod));
                const _requestWorker = (module, options) => archae.requestWorker(module, options);
                const _destroy = () => {
                  if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                  }
                };

                Promise.resolve()
                  .then(() => _requestMods(modsStatus.filter(mod => mod.installed).map(mod => '/extra/plugins/zeo/' + mod.name)))
                  .then(() => {
                    console.log('initial mods loaded');
                  })
                  .catch(err => {
                    console.warn(err);
                  });

                const world = {
                  name: worldName,
                  getWorldTime: _getWorldTime,
                  requestAddMod: _requestAddMod,
                  requestAddMods: _requestAddMods,
                  requestMod: _requestMod,
                  requestMods: _requestMods,
                  requestRemoveMod: _requestRemoveMod,
                  requestRemoveMods: _requestRemoveMods,
                  requestReleaseMod: _requestReleaseMod,
                  requestReleaseMods: _requestReleaseMods,
                  requestWorker: _requestWorker,
                  addUpdate: _addUpdate,
                  addUpdateEye: _addUpdateEye,
                  physics,
                  player,
                  destroy: _destroy,
                };

                worlds.set(worldName, world);
                currentWorld = world;

                mods.set(worldName, modsStatus);
                currentMods = modsStatus;

                accept();
              });
          }
        });
        const _requestDeleteWorld = worldName => new Promise((accept, reject) => {
          accept();
          /* bullet.releaseWorld(worldName)
            .then(() => {
              worlds.delete(worldName);
              mods.delete(worldName);

              if (currentWorld && currentWorld.name === worldName) {
                currentWorld = null;
                currentMods = null;
              }

              accept();
            })
            .catch(reject); */
        });

        const worldName = 'proteus';
        const _initializeWorld = () => _requestDeleteWorld(worldName)
          .then(() => {
            if (live) {
              return _requestChangeWorld(worldName);
            }
          });
        const _initializeMenu = () => {
          if (live) {
            const fontSize = 72;
            const lineHeight = 1.4;
            const inputText = 'Hello, world! This is some text!';
            let inputValue = 0;
            let sliderValue = 0.5;

            const readme = `${_renderMarkdown(readmeText)/*.replace(/<code /g, '<code style="display: block; white-space: pre-wrap; width: 300px; overflow: hidden;" ')*/}`;
            const getMainPageSrc = () => `\
${getHeaderSrc('zeo.sh', '', '', false)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getMainSidebarSrc()}
    <div style="width: ${WIDTH - 500}px;"></div>
  </div>
</div>
`;
            const getReadmeSrc = () => `\
<div style="width: ${WIDTH - 500}px; height: ${HEIGHT - (150 + 2)}px;">
  ${readme}
</div>
`;
            const getInputSrc = (inputText, inputValue) => `\
<div style='position: relative; height: 100px; width ${WIDTH - (500 + 40)}px; font-size: ${fontSize}px; line-height: ${lineHeight};'>
  <a style='display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0;' onclick="input">
    <div style="position: absolute; top: 0; bottom: 20px; left: 0; right: 0; border-bottom: 5px solid #333; box-sizing: border-box;"></div>
    <div style="position: absolute; width: 2px; top: 0; bottom: 20px; left: ${inputValue * (WIDTH - (500 + 40))}px; background-color: #333;"></div>
    <div>${inputText}</div>
  </a>
</div>
`;
            const getSliderSrc = sliderValue => `\
<div style="position: relative; width ${WIDTH - (500 + 40)}px; height: 100px;">
  <a style="display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0;" onclick="resolution">
    <div style="position: absolute; top: 40px; left: 0; right: 0; height: 10px; background-color: #CCC;">
    <div style="position: absolute; top: -40px; bottom: -40px; left: ${sliderValue * (WIDTH - (500 + 40))}px; margin-left: -5px; width: 10px; background-color: #F00;"></div>
    </div>
  </a>
</div>
`;
            const getModsPageSrc = ({mods}) => {
              const installedMods = mods.filter(mod => mod.installed);
              const availableMods = mods.filter(mod => !mod.installed);

              const getModSrc = mod => `\
<a style="display: inline-flex; width: ${(WIDTH - 500) / 3}px; float: left; overflow: hidden;" onclick="mod:${mod.name}">
  <img src="${creatureUtils.makeStaticCreature('mod:' + mod.name)}" style="width: 100px; height: 100px; image-rendering: pixelated;" />
  <div style="width: ${((WIDTH - 500) / 3) - (20 + 100)}px;">
    <div style="font-size: 32px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${mod.name}</div>
    <div style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; width: 100%; height: ${20 * 1.4 * 2}px; font-size: 20px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis;">${mod.description}</div>
  </div>
</a>`;
              const getModsSrc = mods => `\
<div style="width: inherit; float: left; clear: both;">
  ${mods.map(getModSrc).join('\n')}
</div>
`;

              return `\
${getHeaderSrc('mods', '', '', true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getModsSidebarSrc()}
    <div style="width: ${WIDTH - 500}px; clear: both;">
      <h1 style="border-bottom: 2px solid #333; font-size: 50px;">Installed mods</h1>
      ${getModsSrc(installedMods)}
      <h1 style="border-bottom: 2px solid #333; font-size: 50px;">Available mods</h1>
      ${getModsSrc(availableMods)}
    </div>
  </div>
</div>
`;
            };
            const getModPageSrc = ({name, version, installed}) => `\
${getHeaderSrc(name, 'v' + version, getGetButtonSrc(name, installed), true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getModSidebarSrc()}
  </div>
</div>
`;
            const getModPageReadmeSrc = () => `\
<div style="position: absolute; top: 0; right: 0; height: 50px; width: 50px; background-color: red;"></div>
<div style="position: absolute; top: 0; right: 50px; height: 100px; width: 50px; background-color: red;"></div>
<div style="position: absolute; top: 0; right: 100px; height: 150px; width: 50px; background-color: red;"></div>
${getReadmeSrc()}
`;
            const getConfigPageSrc = () => `\
${getHeaderSrc('preferences', '', '', true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getConfigSidebarSrc()}
    <div style="width: ${WIDTH - 500}px;"></div>
  </div>
</div>
`;
            const getConfigPageContentSrc = ({inputText, inputValue, sliderValue}) => `\
<div style="width: ${WIDTH - (500 + 40)}px; height: ${HEIGHT - (150 + 2)}px; padding-right: 40px;">
  ${getInputSrc(inputText, inputValue)}
  ${getSliderSrc(sliderValue)}
</div>
`;

            const getHeaderSrc = (text, subtext, getButtonSrc, backButton) => `\
<div style="height: 150px; border-bottom: 2px solid #333; clear: both; font-size: 107px; line-height: 1.4;">
  ${backButton ? `<a style="display: inline-block; width: 150px; float: left; text-align: center;" onclick="back">❮</a>` : ''}
  <span style="display: inline-block; width: 150px; height: 150px; margin-right: 30px; float: left;"></span>
  <h1 style="display: inline-block; margin: 0; float: left; font-size: inherit; line-height: inherit;">${text}</h1>
  ${subtext ? `<div style="display: inline-flex; height: 150px; margin-left: 20px; float: left; align-items: flex-end;">
    <h2 style="margin: 0; font-size: 60px; line-height: 110px;">${subtext}</h2>
  </div>` : ''}
  ${getButtonSrc ? `<div style="float: right;">
    ${getButtonSrc}
  </div>` : ''}
</div>`;
            const getMainSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a onclick="next"><p>Change world</p></a>
  <a onclick="next"><p>Add/Remove Mods</p></a>
  <a onclick="config"><p>Preferences</p></a>
  <a onclick="blank"><p>About</p></a>
</div>`;
            const getModsSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a onclick="blank"><p>Installed mod</p></a>
  <a onclick="blank"><p>Available mods</p></a>
  <a onclick="blank"><p>Search mods</p></a>
</div>`;
            const getModSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a onclick="blank"><p>Install mod</p></a>
  <a onclick="blank"><p>Remove mod</p></a>
  <a onclick="blank"><p>Configure mod</p></a>
</div>`;
            const getConfigSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a onclick="blank"><p>Preferences</p></a>
  <a onclick="blank"><p>About</p></a>
</div>`;
           const getGetButtonSrc = (name, installed) => `\
<div style="display: flex; height: 150px; margin: 0 30px; align-items: center;">
  ${installed ?
   `<div style="font-size: 50px; margin-right: 30px;">✓ Installed</div>
    <a style="padding: 10px 40px; border: 3px solid #d9534f; border-radius: 5px; font-size: 50px; color: #d9534f;" onclick="removemod:${name}">× Remove</a>`
  :
    `<a style="padding: 10px 40px; background-color: #5cb85c; border-radius: 5px; font-size: 50px; color: #FFF;" onclick="getmod:${name}">+ Get</a>`
  }
</div>`;

            const imageShader = {
              uniforms: {
                textures: {
                  type: 'tv',
                  value: null,
                },
                validTextures: {
                  type: 'iv1',
                  value: null,
                },
                texturePositions: {
                  type: 'v2v',
                  value: null,
                },
                textureDimensions: {
                  type: 'v2v',
                  value: null,
                },
                textureOffsets: {
                  type: 'fv1',
                  value: null,
                }/* ,
                textureClips: {
                  type: 'fv1',
                  value: null,
                }, */
              },
              vertexShader: [
                "varying vec2 vUv;",
                "void main() {",
                "  vUv = uv;",
                "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
                "}"
              ].join("\n"),
              fragmentShader: [
                "uniform sampler2D textures[" + maxNumTextures + "];",
                "uniform int validTextures[" + maxNumTextures + "];",
                "uniform vec2 texturePositions[" + maxNumTextures + "];",
                "uniform vec2 textureDimensions[" + maxNumTextures + "];",
                "uniform float textureOffsets[" + maxNumTextures + "];",
                "// uniform float textureClips[" + maxNumTextures + "];",
                "varying vec2 vUv;",
                "void main() {",
                "  vec3 diffuse = vec3(0.0, 0.0, 0.0);",
                "  float alpha = 0.0;",
                "  int numDiffuse = 0;",
                "  int numAlpha = 0;",
                "  for (int i = 0; i < " + maxNumTextures + "; i++) {",
                "    if (validTextures[i] != 0) {",
                "      vec2 uv = vec2(",
                "        (vUv.x - texturePositions[i].x) / textureDimensions[i].x,",
                "        1.0 - (((1.0 - vUv.y) - texturePositions[i].y) / textureDimensions[i].y)",
                "      );",
                "      if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {",
                "        uv.y -= textureOffsets[i] / textureDimensions[i].y;",
                "        if (uv.y > 0.0) {",
                "          vec4 sample = texture2D(textures[i], uv);",
                "          diffuse += sample.xyz;",
                "          numDiffuse++;",
                "",
                "          if (sample.w > 0.0) {",
                "            alpha += sample.w;",
                "            numAlpha++;",
                "          }",
                "        }",
                "      }",
                "    }",
                "  }",
                "  gl_FragColor = vec4(diffuse / float(numDiffuse), alpha / float(numAlpha));",
                "}"
              ].join("\n")
            };

            return biolumi.requestUi({
              width: WIDTH,
              height: HEIGHT,
            }).then(ui => {
              if (live) {
                const measureText = (() => {
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  ctx.font = `normal ${fontWeight} ${fontSize}px/${lineHeight} ${fonts}`;

                  return text => ctx.measureText(text).width;
                })();

                ui.pushPage([
                  {
                    type: 'html',
                    src: getMainPageSrc({inputValue, sliderValue}),
                  },
                  {
                    type: 'html',
                    src: getReadmeSrc(),
                    x: 500,
                    y: 150 + 2,
                    w: WIDTH - 500,
                    h: HEIGHT - (150 + 2),
                    scroll: true,
                  },
                  {
                    type: 'image',
                    img: creatureUtils.makeAnimatedCreature('zeo.sh'),
                    x: 0,
                    y: 0,
                    w: 150,
                    h: 150,
                    frameTime: 300,
                  }
                ], {
                  type: 'main',
                });

                const solidMaterial = new THREE.MeshBasicMaterial({
                  color: 0xFFFFFF,
                  opacity: 0.5,
                  transparent: true,
                  // alphaTest: 0.5,
                  depthWrite: false,
                });
                const wireframeMaterial = new THREE.MeshBasicMaterial({
                  color: 0x0000FF,
                  wireframe: true,
                  opacity: 0.5,
                  transparent: true,
                });
                const pointsMaterial = new THREE.PointsMaterial({
                  color: 0x000000,
                  size: 0.01,
                });

                const menuMesh = (() => {
                  const result = new THREE.Object3D();
                  result.position.y = 1.5;
                  result.position.z = -0.5;

                  const imageMaterial = (() => {
                    const shaderUniforms = THREE.UniformsUtils.clone(imageShader.uniforms);
                    shaderUniforms.textures.value = (() => {
                      const result = Array(maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
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
                        // texture.needsUpdate = true;

                        result[i] = texture;
                      }
                      return result;
                    })();
                    shaderUniforms.validTextures.value = (() => {
                      const result = Array(maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        result[i] = 0;
                      }
                      return result;
                    })();
                    shaderUniforms.texturePositions.value = (() => {
                      const result = Array(2 * maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        result[(i * 2) + 0] = 0;
                        result[(i * 2) + 1] = 0;
                      }
                      return result;
                    })();
                    shaderUniforms.textureDimensions.value = (() => {
                      const result = Array(2 * maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        result[(i * 2) + 0] = 0;
                        result[(i * 2) + 1] = 0;
                      }
                      return result;
                    })();
                    shaderUniforms.textureOffsets.value = (() => {
                      const result = Array(maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        result[i] = 0;
                      }
                      return result;
                    })();
                    /* shaderUniforms.textureClips.value = (() => {
                      const result = Array(maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        result[i] = 0;
                      }
                      return result;
                    })(); */
                    const shaderMaterial = new THREE.ShaderMaterial({
                      uniforms: shaderUniforms,
                      vertexShader: imageShader.vertexShader,
                      fragmentShader: imageShader.fragmentShader,
                      transparent: true,
                    });
                    // shaderMaterial.polygonOffset = true;
                    // shaderMaterial.polygonOffsetFactor = 1;
                    return shaderMaterial;
                  })();

                  const planeMesh = (() => {
                    const width = WORLD_WIDTH;
                    const height = WORLD_HEIGHT;
                    const depth = WORLD_DEPTH;

                    const geometry = new THREE.PlaneBufferGeometry(width, height, depth);
                    const materials = [solidMaterial, imageMaterial];

                    const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                    mesh.imageMaterial = imageMaterial;
                    return mesh;
                  })();
                  result.add(planeMesh);
                  result.planeMesh = planeMesh;

                  return result;
                })();
                scene.add(menuMesh);

                const boxMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(1, 1, 1);

                  const mesh = new THREE.Mesh(geometry, wireframeMaterial);
                  mesh.visible = false;
                  // mesh.renderOrder = -1;
                  mesh.scrollLayer = null;
                  mesh.anchor = null;
                  return mesh;
                })();
                scene.add(boxMesh);

                const dotMesh = (() => {
                  const geometry = new THREE.BufferGeometry();
                  geometry.addAttribute('position', new THREE.BufferAttribute(Float32Array.from([0, 0, 0]), 3));

                  const mesh = new THREE.Points(geometry, pointsMaterial);
                  return mesh;
                })();
                scene.add(dotMesh);

                const click = () => {
                  const {anchor} = boxMesh;

                  if (anchor) {
                    const {onclick} = anchor;

                    if (onclick) {
                      let match;
                      if (onclick === 'back') {
                        ui.cancelTransition();

                        if (ui.getPages().length > 1) {
                          ui.popPage();
                        }
                      } else if (onclick === 'next') {
                        ui.cancelTransition();

                        if (ui.getPages().length < 3) {
                          const mods = currentMods;

                          ui.pushPage(({mods}) => ([
                            {
                              type: 'html',
                              src: getModsPageSrc({mods}),
                            },
                            {
                              type: 'image',
                              img: creatureUtils.makeAnimatedCreature('mods'),
                              x: 150,
                              y: 0,
                              w: 150,
                              h: 150,
                              frameTime: 300,
                            }
                          ]), {
                            type: 'mods',
                            state: {
                              mods,
                            },
                          });
                        } else {
                          ui.popPage();
                        }
                      } else if (match = onclick.match(/^mod:(.+)$/)) {
                        const name = match[1];
                        const mods = currentMods;
                        const mod = mods.find(m => m.name === name);

                        ui.cancelTransition();

                        if (ui.getPages().length < 3) {
                          ui.pushPage(({mod: {name, version, installed}}) => ([
                            {
                              type: 'html',
                              src: getModPageSrc({name, version, installed}),
                            },
                            {
                              type: 'html',
                              src: getReadmeSrc(),
                              x: 500,
                              y: 150 + 2,
                              w: WIDTH - 500,
                              h: HEIGHT - (150 + 2),
                              scroll: true,
                            },
                            {
                              type: 'image',
                              img: creatureUtils.makeAnimatedCreature('mod:' + name),
                              x: 150,
                              y: 0,
                              w: 150,
                              h: 150,
                              frameTime: 300,
                            }
                          ]), {
                            type: 'mod:' + name,
                            state: {
                              mod,
                            },
                          }, {
                            postCb: () => {
                              const layers = ui.getLayers();
                              const readmeLayer = layers[layers.length - 3];
                              readmeLayer.scrollTo(100);
                            },
                          });
                        } else {
                          ui.popPage();
                        }
                      } else if (match = onclick.match(/^getmod:(.+)$/)) {
                        const name = match[1];

                        currentWorld.requestAddMod(name)
                          .then(() => {
                            const mods = currentMods;
                            const mod = mods.find(m => m.name === name);

                            const pages = ui.getPages();
                            for (let i = 0; i < pages.length; i++) {
                              const page = pages[i];
                              const {type} = page;
                              if (type === 'mod:' + name) {
                                page.update({mod});
                              } else if (type === 'mods') {
                                page.update({mods});
                              }
                            }
                          })
                          .catch(err => {
                            console.warn(err);
                          });
                      } else if (match = onclick.match(/^removemod:(.+)$/)) {
                        const name = match[1];

                        currentWorld.requestRemoveMod(name)
                          .then(() => {
                            const mods = currentMods;
                            const mod = mods.find(m => m.name === name);

                            const pages = ui.getPages();
                            for (let i = 0; i < pages.length; i++) {
                              const page = pages[i];
                              const {type} = page;
                              if (type === 'mod:' + name) {
                                page.update({mod});
                              } else if (type === 'mods') {
                                page.update({mods});
                              }
                            }
                          })
                          .catch(err => {
                            console.warn(err);
                          });
                      } else if (onclick === 'config') {
                        ui.pushPage(({inputText, inputValue, sliderValue}) => ([
                          {
                            type: 'html',
                            src: getConfigPageSrc(),
                          },
                          {
                            type: 'html',
                            src: getConfigPageContentSrc({inputText, inputValue, sliderValue}),
                            x: 500,
                            y: 150 + 2,
                            w: WIDTH - 500,
                            h: HEIGHT - (150 + 2),
                            scroll: true,
                          },
                          {
                            type: 'image',
                            img: creatureUtils.makeAnimatedCreature('preferences'),
                            x: 150,
                            y: 0,
                            w: 150,
                            h: 150,
                            frameTime: 300,
                          }
                        ]), {
                          type: 'config',
                          state: {inputText, inputValue, sliderValue},
                        });
                      } else if (onclick === 'input') {
                        const {value} = boxMesh;
                        const valuePx = value * (WIDTH - (500 + 40));

                        const slices = (() => {
                          const result = [];
                          for (let i = 0; i <= inputText.length; i++) {
                            const slice = inputText.slice(0, i);
                            result.push(slice);
                          }
                          return result;
                        })();
                        const widths = slices.map(slice => measureText(slice));
                        const distances = widths.map(width => Math.abs(valuePx - width));
                        const sortedDistances = distances
                          .map((distance, index) => ([distance, index]))
                          .sort(([aDistance], [bDistance]) => (aDistance - bDistance));
                        const index = sortedDistances[0][1];
                        const closestValuePx = widths[index];
                        // const slice = slices[index];

                        inputValue = closestValuePx / (WIDTH - (500 + 40));

                        const pages = ui.getPages();
                        for (let i = 0; i < pages.length; i++) {
                          const page = pages[i];
                          const {type} = page;
                          if (type === 'config') {
                            page.update({inputText, inputValue, sliderValue});
                          }
                        }
                      } else if (onclick === 'resolution') {
                        const {value} = boxMesh;

                        sliderValue = value;

                        const pages = ui.getPages();
                        for (let i = 0; i < pages.length; i++) {
                          const page = pages[i];
                          const {type} = page;
                          if (type === 'config') {
                            page.update({inputText, inputValue, sliderValue});
                          }
                        }
                      }
                    }
                  }
                };
                window.addEventListener('click', click);
                const mousedown = () => {
                  const {scrollLayer} = boxMesh;
                  if (scrollLayer) {
                    console.log('mousedown scroll layer', scrollLayer);
                  } else {
                    console.log('mousedown no scroll layer');
                  }
                };
                window.addEventListener('mousedown', mousedown);
                const mouseup = () => {
                  const {scrollLayer} = boxMesh;
                  if (scrollLayer) {
                    console.log('mouseup scroll layer', scrollLayer);
                  } else {
                    console.log('mouseup no scroll layer');
                  }
                };
                window.addEventListener('mouseup', mouseup);

                cleanups.push(() => {
                  scene.remove(menuMesh);
                  scene.remove(boxMesh);
                  scene.remove(dotMesh);

                  window.removeEventListener('click', click);
                  window.removeEventListener('mousedown', mousedown);
                  window.removeEventListener('mouseup', mouseup);
                });

                updates.push(() => {
                  const _updateMenuMesh = () => {
                    const {planeMesh: {imageMaterial}} = menuMesh;
                    const {uniforms: {texture, textures, validTextures, texturePositions, textureDimensions, textureOffsets/* , textureClips*/}} = imageMaterial;

                    const layers = ui.getLayers();
                    const worldTime = currentWorld.getWorldTime();
                    for (let i = 0; i < maxNumTextures; i++) {
                      const layer = i < layers.length ? layers[i] : null;

                      if (layer && layer.getValid({worldTime})) {
                        validTextures.value[i] = 1;

                        if (textures.value[i].image !== layer.img) {
                          textures.value[i].image = layer.img;
                          textures.value[i].needsUpdate = true;
                        }

                        const position = layer.getPosition();
                        texturePositions.value[(i * 2) + 0] = position.x;
                        texturePositions.value[(i * 2) + 1] = position.y;
                        textureDimensions.value[(i * 2) + 0] = position.w;
                        textureDimensions.value[(i * 2) + 1] = position.h;
                        textureOffsets.value[i] = position.st;
                        // textureClips.value[i] = position.ch;
                      } else {
                        validTextures.value[i] = 0;
                      }
                    }
                  };
                  const _updateAnchors = () => {
                    const cameraPosition = new THREE.Vector3();
                    const cameraRotation = new THREE.Quaternion();
                    const cameraScale = new THREE.Vector3();
                    camera.matrixWorld.decompose(cameraPosition, cameraRotation, cameraScale);

                    const ray = new THREE.Vector3(0, 0, -1)
                      .applyQuaternion(cameraRotation);
                    const cameraLine = new THREE.Line3(
                      cameraPosition.clone(),
                      cameraPosition.clone().add(ray.clone().multiplyScalar(15))
                    );

                    const menuPosition = new THREE.Vector3();
                    const menuRotation = new THREE.Quaternion();
                    const menuScale = new THREE.Vector3();
                    menuMesh.matrixWorld.decompose(menuPosition, menuRotation, menuScale);
                    const menuNormalZ = new THREE.Vector3(0, 0, 1).applyQuaternion(menuRotation);

                    const menuPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(menuNormalZ, menuPosition);
                    const intersectionPoint = menuPlane.intersectLine(cameraLine);
                    if (intersectionPoint) {
                      const _getPlanePoint = (x, y, z) => menuPosition.clone()
                        .add(
                          new THREE.Vector3(
                            -WORLD_WIDTH / 2,
                            WORLD_HEIGHT / 2,
                            0
                          )
                          .add(
                            new THREE.Vector3(
                              (x / WIDTH) * WORLD_WIDTH,
                              (-y / HEIGHT) * WORLD_HEIGHT,
                              z
                            )
                          ).applyQuaternion(menuRotation)
                        );

                      const scrollLayerBoxes = ui.getLayers()
                        .filter(layer => layer.scroll)
                        .map(layer => {
                          const rect = layer.getRect();
                          const layerBox = new THREE.Box3().setFromPoints([
                            _getPlanePoint(rect.left, rect.top, -WORLD_DEPTH),
                            _getPlanePoint(rect.right, rect.bottom, WORLD_DEPTH),
                          ]);
                          layerBox.layer = layer;
                          return layerBox;
                        });
                      const scrollLayerBox = (() => {
                        for (let i = 0; i < scrollLayerBoxes.length; i++) {
                          const layerBox = scrollLayerBoxes[i];
                          if (layerBox.containsPoint(intersectionPoint)) {
                            return layerBox;
                          }
                        }
                        return null;
                      })();
                      if (scrollLayerBox) {
                        boxMesh.scrollLayer = scrollLayerBox.layer;
                      } else {
                        boxMesh.scrollLayer = null;
                      }

                      const anchorBoxes = (() => {
                        const result = [];
                        const layers = ui.getLayers();
                        for (let i = 0; i < layers.length; i++) {
                          const layer = layers[i];
                          const anchors = layer.getAnchors();

                          for (let j = 0; j < anchors.length; j++) {
                            const anchor = anchors[j];
                            const {rect} = anchor;

                            const anchorBox = new THREE.Box3().setFromPoints([
                              _getPlanePoint(rect.left, rect.top, -WORLD_DEPTH),
                              _getPlanePoint(rect.right, rect.bottom, WORLD_DEPTH),
                            ]);
                            anchorBox.anchor = anchor;

                            result.push(anchorBox);
                          }
                        }
                        return result;
                      })();
                      const anchorBox = (() => {
                        for (let i = 0; i < anchorBoxes.length; i++) {
                          const anchorBox = anchorBoxes[i];
                          if (anchorBox.containsPoint(intersectionPoint)) {
                            return anchorBox;
                          }
                        }
                        return null;
                      })();
                      if (anchorBox) {
                        boxMesh.position.copy(anchorBox.min.clone().add(anchorBox.max).divideScalar(2));
                        boxMesh.scale.copy(anchorBox.max.clone().sub(anchorBox.min));

                        const {anchor} = anchorBox;
                        boxMesh.anchor = anchor;
                        boxMesh.value = (() => {
                          const {rect} = anchor;
                          const horizontalLine = new THREE.Line3(
                            _getPlanePoint(rect.left, (rect.top + rect.bottom) / 2, 0),
                            _getPlanePoint(rect.right, (rect.top + rect.bottom) / 2, 0)
                          );
                          const closestHorizontalPoint = horizontalLine.closestPointToPoint(intersectionPoint, true);
                          return new THREE.Line3(horizontalLine.start.clone(), closestHorizontalPoint.clone()).distance() / horizontalLine.distance();
                        })();

                        if (!boxMesh.visible) {
                          boxMesh.visible = true;
                        }
                      } else {
                        boxMesh.anchor = null;
                        boxMesh.value = 0;

                        if (boxMesh.visible) {
                          boxMesh.visible = false;
                        }
                      }

                      dotMesh.position.copy(intersectionPoint);
                    }
                  };

                  _updateMenuMesh();
                  _updateAnchors();
                });
              }
            });
          }
        };
        const _initialize = () => _initializeWorld()
          .then(() => _initializeMenu());

        return _initialize()
          .then(() => {
            const _update = () => {
              for (let i = 0; i < updates.length; i++) {
                const update = updates[i];
                update();
              }
            };
            const _updateEye = camera => {
              for (let i = 0; i < updateEyes.length; i++) {
                const updateEye = updateEyes[i];
                updateEye(camera);
              }
            }

            return {
              getCurrentWorld: _getCurrentWorld,
              update: _update,
              updateEye: _updateEye,
            };
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const readmeText = heredoc.strip(() => {/*
three.js
========

[![Latest NPM release][npm-badge]][npm-badge-url]
[![License][license-badge]][license-badge-url]
[![Dependencies][dependencies-badge]][dependencies-badge-url]
[![Dev Dependencies][devDependencies-badge]][devDependencies-badge-url]

#### JavaScript 3D library ####

The aim of the project is to create an easy to use, lightweight, 3D library. The library provides &lt;canvas&gt;, &lt;svg&gt;, CSS3D and WebGL renderers.

[Examples](http://threejs.org/examples/) &mdash;
[Documentation](http://threejs.org/docs/) &mdash;
[Wiki](https://github.com/mrdoob/three.js/wiki) &mdash;
[Migrating](https://github.com/mrdoob/three.js/wiki/Migration) &mdash;
[Help](http://stackoverflow.com/questions/tagged/three.js)

### Usage ###

Download the [minified library](http://threejs.org/build/three.min.js) and include it in your html.
Alternatively see [how to build the library yourself](https://github.com/mrdoob/three.js/wiki/Build-instructions).

```html
<script src="js/three.min.js"></script>
```

This code creates a scene, a camera, and a geometric cube, and it adds the cube to the scene. It then creates a `WebGL` renderer for the scene and camera, and it adds that viewport to the document.body element. Finally it animates the cube within the scene for the camera.

```javascript
var scene, camera, renderer;
var geometry, material, mesh;

init();
animate();

function init() {

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = 1000;

	geometry = new THREE.BoxGeometry( 200, 200, 200 );
	material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true } );

	mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );

	document.body.appendChild( renderer.domElement );

}

function animate() {

	requestAnimationFrame( animate );

	mesh.rotation.x += 0.01;
	mesh.rotation.y += 0.02;

	renderer.render( scene, camera );

}
```

If everything went well you should see [this](http://jsfiddle.net/hfj7gm6t/).

### Change log ###

[releases](https://github.com/mrdoob/three.js/releases)



[npm-badge]: https://img.shields.io/npm/v/three.svg
[npm-badge-url]: https://www.npmjs.com/package/three
[license-badge]: https://img.shields.io/npm/l/three.svg
[license-badge-url]: ./LICENSE
[dependencies-badge]: https://img.shields.io/david/mrdoob/three.js.svg
[dependencies-badge-url]: https://david-dm.org/mrdoob/three.js
[devDependencies-badge]: https://img.shields.io/david/dev/mrdoob/three.js.svg
[devDependencies-badge-url]: https://david-dm.org/mrdoob/three.js#info=devDependencies
*/});
const _renderMarkdown = s =>
  showdownConverter
    .makeHtml(s)
    .replace(/&mdash;/g, '-')
    .replace(/(<code\s*[^>]*?>)([^>]*?)(<\/code>)/g, (all, start, mid, end) => start + mid.replace(/\n/g, '<br/>') + end)
    .replace(/\n+/g, ' ');

module.exports = Rend;
