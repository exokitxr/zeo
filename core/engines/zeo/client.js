class Zeo {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let cleanups = [];
    const _cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
      cleanups = [];
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestPlugins([
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/three',
      '/core/engines/anima',
      '/core/engines/cyborg',
      '/core/engines/hands',
      '/core/engines/rend',
      '/core/engines/biolumi',
      '/core/engines/teleport',
      '/core/engines/backpack',
      '/core/engines/npm',
      '/core/engines/fs',
      '/core/engines/somnifer',
      '/core/engines/bullet',
      '/core/engines/heartlink',
      '/core/plugins/js-utils',
    ]).then(([
      input,
      webvr,
      three,
      anima,
      cyborg,
      hands,
      rend,
      biolumi,
      teleport,
      backpack,
      npm,
      fs,
      somnifer,
      bullet,
      heartlink,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {domElement} = renderer;
        const {EVENTS} = input;
        const {sound} = somnifer;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const inputEventsIndex = (() => {
          const result = {};
          for (let i = 0; i < EVENTS.length; i++) {
            const eventName = EVENTS[i];
            result[eventName] = true;
          }
          return result;
        })();
        const supportsWebVR = webvr.supportsWebVR();

        const updates = [];
        const updateEyes = [];
        const _update = () => {
          rend.update();
        };
        const _updateEye = camera => {
          rend.updateEye(camera);
        };
        const _updateStart = () => {
          rend.updateStart();
        };
        const _updateEnd = () => {
          rend.updateEnd();
        };

        const _enterNormal = () => {
          _stopRenderLoop();

          renderLoop = webvr.requestRenderLoop({
            update: _update,
            updateEye: _updateEye,
            updateStart: _updateStart,
            updateEnd: _updateEnd,
          });

          return renderLoop;
        };
        const _enterVR = ({stereoscopic}) => {
          _stopRenderLoop();

          const _onExit = () => {
            _enterNormal();
          };

          renderLoop = webvr.requestEnterVR({
            stereoscopic,
            update: _update,
            updateEye: _updateEye,
            updateStart: _updateStart,
            updateEnd: _updateEnd,
            onExit: _onExit,
          });

          return renderLoop;
        };

        let renderLoop = null;
        const _stopRenderLoop = () => {
          if (renderLoop) {
            renderLoop.destroy();
            renderLoop = null;
          }
        };
        const _startRenderLoop = () => {
          cleanups.push(() => {
            _stopRenderLoop();
          });

          return _enterNormal();
        };

        const _requestAnchor = (src, color, hoverColor, click) => new Promise((accept, reject) => {
          const img = new Image();
          img.src = src;
          img.style.cssText = `\
filter: invert(100%);
`;
          img.onload = () => {
            const a = document.createElement('a');
            a.style.cssText = `\
position: relative;
width: 100px;
height: 100px;
background-color: ${color};
`;
            a.appendChild(img);

            a.addEventListener('click', click);
            a.addEventListener('mouseenter', e => {
              a.style.cursor = 'pointer';
              a.style.backgroundColor = hoverColor;
            });
            a.addEventListener('mouseleave', e => {
              a.style.cursor = 'auto';
              a.style.backgroundColor = color;
            });
            a.addEventListener('mousemove', e => {
              e.preventDefault();
              e.stopPropagation();
            });

            accept(a);
          };
          img.onerror = err => {
            reject(err);
          };
        });

        return _startRenderLoop()
          .then(() => {
            if (live) {
              return Promise.all([
                _requestAnchor(
                  keyboardIconSrc,
                  '#000',
                  '#2196F3',
                  () => {
                    if (!webvr.display) {
                      _enterVR({
                        stereoscopic: false,
                      });
                    }
                  }
                ),
                _requestAnchor(
                  vrIconSrc,
                  supportsWebVR ? '#4CAF50' : '#E91E63',
                  supportsWebVR ? '#43A047' : '#D81B60',
                  () => {
                    if (!webvr.display) {
                      _enterVR({
                        stereoscopic: true,
                      });
                    }
                  }
                ),
              ]);
            }
          })
          .then(([keyboardMouseAnchor, vrAnchor]) => {
            if (live) {
              const navbar = document.createElement('div');
              navbar.style.cssText = `\
position: absolute;
display: flex;
bottom: 0;
left: 0;
right: 0;
height: 100px;
background-color: #000;
font-family: 'Open Sans';
color: white;
`;
              const wasd = document.createElement('div');
              wasd.style.cssText = `\
display: flex;
width: 200px;
height: 100px;
justify-content: center;
flex-direction: column;
`;
              wasd.innerHTML = `\
<div style="display: flex; justify-content: center;">
  <div style="display: flex; width: 40px; height: 40px; margin: 2px; border: 2px solid #FFF; border-radius: 6px; justify-content: center; align-items: center; box-sizing: border-box;">W</div>
</div>
<div style="display: flex; justify-content: center;">
  <div style="display: flex; width: 40px; height: 40px; margin: 2px; border: 2px solid #FFF; border-radius: 6px; justify-content: center; align-items: center; box-sizing: border-box;">A</div>
  <div style="display: flex; width: 40px; height: 40px; margin: 2px; border: 2px solid #FFF; border-radius: 6px; justify-content: center; align-items: center; box-sizing: border-box;">S</div>
  <div style="display: flex; width: 40px; height: 40px; margin: 2px; border: 2px solid #FFF; border-radius: 6px; justify-content: center; align-items: center; box-sizing: border-box;">D</div>
</div>
`;
              navbar.appendChild(wasd);
              const help = document.createElement('div');
              help.style.cssText = `\
display: flex;
margin: 50px 0;
font-size: 13px;
justify-content: center;
flex-direction: column;
`;
              help.innerHTML = `\
<p style="margin: 3px 0; font-size: 16px;">Welcome to zeo!</p>
<p style="margin: 3px 0;">Take control with <span style="color: #03A9F4;">Keyboard + Mouse</span> or <span style="color: ${supportsWebVR ? '#8BC34A' : '#E91E63'};">WebVR</span>. Looks like <span style="color: ${supportsWebVR ? '#8BC34A' : '#E91E63'};">WebVR is ${supportsWebVR ? '' : 'not '}supported</span> in your browser!</p>
<p style="margin: 3px 0;">WASD: move, Z/C: select left/right controller, Click: trigger, Mousewheel: move controller, E: menu, F: grip, Q: pad, Shift+Mousewheel: rotate controller, Ctrl+Mousewheel: Controller forward/back, Alt+Mousewheel: touchpad.</p>
`;
              navbar.appendChild(help);
              const anchors = document.createElement('div');
              anchors.style.cssText = `\
display: flex;
width: 200px;
height: 100px;
`;
              anchors.appendChild(keyboardMouseAnchor);
              anchors.appendChild(vrAnchor);
              navbar.appendChild(anchors);
              document.body.appendChild(navbar);

              class Listener {
                constructor(handler, priority) {
                  this.handler = handler;
                  this.priority = priority;
                }
              }

              const _makeEventListener = () => {
                const listeners = [];

                const result = e => {
                  let live = true;
                  e.stopImmediatePropagation = (stopImmediatePropagation => () => {
                    live = false;

                    stopImmediatePropagation.call(e);
                  })(e.stopImmediatePropagation);

                  const oldListeners = listeners.slice();
                  for (let i = 0; i < oldListeners.length; i++) {
                    const listener = oldListeners[i];
                    const {handler} = listener;

                    handler(e);

                    if (!live) {
                      break;
                    }
                  }
                };
                result.add = (handler, {priority}) => {
                  const listener = new Listener(handler, priority);
                  listeners.push(listener);
                  listeners.sort((a, b) => b.priority - a.priority);
                };
                result.remove = handler => {
                  const index = listeners.indexOf(handler);
                  if (index !== -1) {
                    listeners.splice(index, 1);
                  }
                };

                return result;
              };

              this._cleanup = () => {
                _stopRenderLoop();
              };

              class ZeoApi extends EventEmitter {
                constructor({THREE, scene, camera, renderer, sound, anima}) {
                  super();

                  this.THREE = THREE;
                  this.scene = scene;
                  this.camera = camera;
                  this.renderer = renderer;
                  this.sound = sound;
                  this.anima = anima;
                }

                on(eventName, handler, options) {
                  if (inputEventsIndex[eventName]) {
                    input.on(eventName, handler, options);
                    return this;
                  } else {
                    return super.on(eventName, handler);
                  }
                }
                removeListener(eventName, handler) {
                  if (inputEventsIndex[eventName]) {
                    input.removeListener(eventName, handler);
                    return this;
                  } else {
                    return super.removeListener(eventName, handler);
                  }
                }
                removeAllListeners(eventName) {
                  if (inputEventsIndex[eventName]) {
                    input.removeAllListeners(eventName);
                    return this;
                  } else {
                    return super.removeAllListeners(eventName);
                  }
                }

                update() {
                  this.emit('update');
                }
                updateEye(camera) {
                  this.emit('updateEye', camera);
                }

                getCurrentWorld() {
                  return rend.getCurrentWorld();
                }

                getStatus() {
                  return webvr.getStatus();
                }

                canGrab(side, object, options) {
                  return hands.canGrab(side, object, options);
                }
                grab(side, object) {
                  return hands.grab(side, object);
                }
                release(side) {
                  return hands.release(side);
                }

                registerElement(elementApi) {
                  rend.registerElement(elementApi);
                }
                unregisterElement(elementApi) {
                  rend.unregisterElement(elementApi);
                }
              }

              const api = new ZeoApi({
                THREE,
                scene,
                camera,
                renderer,
                sound,
                anima,
              });
              rend.on('update', () => {
                api.update();
              });
              rend.on('updateEye', camera => {
                api.updateEye(camera);
              });

              return api;
            }
          })
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const keyboardIconSrc = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 100 100" enable-background="new 0 0 100 100" xml:space="preserve"><g><path d="M92.292,35.549H76.211v-0.821c0-1.871-1.522-3.394-3.395-3.394H27.033c-1.872,0-3.395,1.522-3.395,3.394v0.821H7.558   c-2.804,0-5.084,2.281-5.084,5.083v25.184c0,2.802,2.28,5.084,5.084,5.084h84.734c2.803,0,5.084-2.282,5.084-5.084V40.632   C97.376,37.83,95.095,35.549,92.292,35.549z M94.562,65.815c0,1.251-1.019,2.27-2.27,2.27H7.558c-1.252,0-2.271-1.019-2.271-2.27   V40.632c0-1.251,1.019-2.27,2.271-2.27h17.488c0.776,0,1.406-0.629,1.406-1.406v-2.229c0-0.319,0.261-0.58,0.581-0.58h45.783   c0.32,0,0.58,0.261,0.58,0.58v2.229c0,0.777,0.631,1.406,1.407,1.406h17.488c1.251,0,2.27,1.019,2.27,2.27V65.815z"/><path d="M89.97,63.221H74.728c-0.776,0-1.407,0.631-1.407,1.406c0,0.777,0.631,1.408,1.407,1.408H89.97   c0.776,0,1.407-0.631,1.407-1.408C91.377,63.852,90.746,63.221,89.97,63.221z"/><path d="M70.279,63.221H59.903c-0.777,0-1.407,0.631-1.407,1.406c0,0.777,0.63,1.408,1.407,1.408h10.376   c0.776,0,1.407-0.631,1.407-1.408C71.687,63.852,71.056,63.221,70.279,63.221z"/><path d="M56.206,63.221H28.255c-0.776,0-1.406,0.631-1.406,1.406c0,0.777,0.63,1.408,1.406,1.408h27.951   c0.776,0,1.407-0.631,1.407-1.408C57.613,63.852,56.982,63.221,56.206,63.221z"/><path d="M24.234,63.221H9.879c-0.777,0-1.406,0.631-1.406,1.406c0,0.777,0.629,1.408,1.406,1.408h14.355   c0.777,0,1.407-0.631,1.407-1.408C25.642,63.852,25.012,63.221,24.234,63.221z"/><path d="M89.97,57.709H74.728c-0.776,0-1.407,0.629-1.407,1.405c0,0.778,0.631,1.409,1.407,1.409H89.97   c0.776,0,1.407-0.631,1.407-1.409C91.377,58.338,90.746,57.709,89.97,57.709z"/><path d="M70.297,57.709h-6.153c-0.776,0-1.407,0.629-1.407,1.405c0,0.778,0.631,1.409,1.407,1.409h6.153   c0.776,0,1.407-0.631,1.407-1.409C71.704,58.338,71.073,57.709,70.297,57.709z"/><path d="M17.699,57.709c-0.777,0-1.406,0.629-1.406,1.405c0,0.778,0.629,1.409,1.406,1.409h42.224c0.776,0,1.407-0.631,1.407-1.409   c0-0.776-0.631-1.405-1.407-1.405H17.699z"/><path d="M9.879,60.523h3.967c0.777,0,1.407-0.631,1.407-1.409c0-0.776-0.63-1.405-1.407-1.405H9.879   c-0.777,0-1.406,0.629-1.406,1.405C8.473,59.893,9.102,60.523,9.879,60.523z"/><path d="M89.97,52.196H74.728c-0.776,0-1.407,0.63-1.407,1.406c0,0.777,0.631,1.407,1.407,1.407H89.97   c0.776,0,1.407-0.63,1.407-1.407C91.377,52.826,90.746,52.196,89.97,52.196z"/><path d="M70.297,46.685h-4.759c-0.776,0-1.407,0.629-1.407,1.405c0,0.778,0.631,1.407,1.407,1.407h3.352v3.847   c0,0.778,0.631,1.407,1.407,1.407s1.407-0.629,1.407-1.407V48.09C71.704,47.313,71.073,46.685,70.297,46.685z"/><path d="M66.863,53.603c0-0.776-0.631-1.406-1.407-1.406H20.04c-0.777,0-1.407,0.63-1.407,1.406c0,0.777,0.63,1.407,1.407,1.407   h45.416C66.232,55.01,66.863,54.38,66.863,53.603z"/><path d="M9.879,55.01h6.02c0.776,0,1.406-0.63,1.406-1.407c0-0.776-0.63-1.406-1.406-1.406h-6.02c-0.777,0-1.406,0.63-1.406,1.406   C8.473,54.38,9.102,55.01,9.879,55.01z"/><path d="M89.97,46.685H74.728c-0.776,0-1.407,0.629-1.407,1.405c0,0.778,0.631,1.407,1.407,1.407H89.97   c0.776,0,1.407-0.629,1.407-1.407C91.377,47.313,90.746,46.685,89.97,46.685z"/><path d="M9.879,49.497h51.639c0.776,0,1.407-0.629,1.407-1.407c0-0.776-0.631-1.405-1.407-1.405H9.879   c-0.777,0-1.406,0.629-1.406,1.405C8.473,48.868,9.102,49.497,9.879,49.497z"/><path d="M89.97,41.172H74.728c-0.776,0-1.407,0.63-1.407,1.406c0,0.777,0.631,1.407,1.407,1.407H89.97   c0.776,0,1.407-0.63,1.407-1.407C91.377,41.802,90.746,41.172,89.97,41.172z"/><path d="M70.297,41.172h-9.518c-0.776,0-1.407,0.63-1.407,1.406c0,0.777,0.631,1.407,1.407,1.407h9.518   c0.776,0,1.407-0.63,1.407-1.407C71.704,41.802,71.073,41.172,70.297,41.172z"/><path d="M43.385,43.985h12.964c0.776,0,1.407-0.63,1.407-1.407c0-0.776-0.631-1.406-1.407-1.406H43.385   c-0.776,0-1.407,0.63-1.407,1.406C41.978,43.355,42.608,43.985,43.385,43.985z"/><path d="M23.773,43.985h15.181c0.776,0,1.407-0.63,1.407-1.407c0-0.776-0.631-1.406-1.407-1.406H23.773   c-0.776,0-1.406,0.63-1.406,1.406C22.367,43.355,22.997,43.985,23.773,43.985z"/><path d="M9.879,43.985h9.957c0.777,0,1.406-0.63,1.406-1.407c0-0.776-0.629-1.406-1.406-1.406H9.879   c-0.777,0-1.406,0.63-1.406,1.406C8.473,43.355,9.102,43.985,9.879,43.985z"/></g></svg>`;
const vrIconSrc = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" data-name="Layer 1" viewBox="0 0 100 100" x="0px" y="0px"><title>cardboard</title><path d="M84.18,29H15.82A5.83,5.83,0,0,0,10,34.82V65.18A5.83,5.83,0,0,0,15.82,71H42.49a1.93,1.93,0,0,0,1.71-1l4-8.12a1.9,1.9,0,0,1,3.42,0l3.81,8A1.91,1.91,0,0,0,57.2,71h27A5.83,5.83,0,0,0,90,65.18V34.82A5.83,5.83,0,0,0,84.18,29ZM32,56.83A6.83,6.83,0,1,1,38.8,50,6.83,6.83,0,0,1,32,56.83Zm36,0A6.83,6.83,0,1,1,74.8,50,6.83,6.83,0,0,1,68,56.83Z"/></svg>`;

module.exports = Zeo;
