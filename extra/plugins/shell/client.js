const htermAll = require('./lib/wetty/hterm_all');
const {hterm, lib} = htermAll;
const io = require('./node_modules/socket.io-client/dist/socket.io.js');

hterm.defaultStorage = new lib.Storage.Local();
lib.ensureRuntimeDependencies_ = () => {}; // HACK: elide the check, because it just checks for globals exposure

const WIDTH = 1280;
const HEIGHT = 1024;
const ASPECT_RATIO = WIDTH / HEIGHT;
const MESH_WIDTH = 1;
const MESH_HEIGHT = MESH_WIDTH / ASPECT_RATIO;

const TILDE_KEY_CODE = 192;

class Shell {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
      '/core/engines/input',
      '/core/engines/biolumi',
    ]).then(([
      zeo,
      input,
      biolumi,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        const transparentImg = biolumi.getTransparentImg();

        let cleanups = [];
        this._cleanup = () => {
          for (let i = 0; i < cleanups.length; i++) {
            const cleanup = cleanups[i];
            cleanup();
          }
          cleanups = [];
        };

        const boxMeshMaterial = new THREE.MeshBasicMaterial({
          color: 0x000000,
          wireframe: true,
          opacity: 0.5,
          transparent: true,
        });

        const updates = [];
        const _update = () => {
          for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            update();
          }
        };

        return {
          update: _update,
          elements: [
            class ShellElement {
              static get tag() {
                return 'shell';
              }
              static get attributes() {
                return {
                  position: {
                    type: 'matrix',
                    value: [
                      0, 0, 0,
                      0, 0, 0, 1,
                      1, 1, 1,
                    ],
                  },
                };
              }

              constructor() {
                this._cleanup = () => {
                  const cleanups = [];
                  for (let i = 0; i < cleanups.length; i++) {
                    const cleanup = cleanups[i];
                    cleanup();
                  }
                };

                const _connect = ({update = () => {}}) => {
                  let cleanups = [];

                  let lastSrc = '';
                  const _render = (src, cb) => {
                    if (src !== lastSrc) {
                      const img = new Image();
                      img.src = 'data:image/svg+xml;charset=utf-8,' +
                      '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'' + WIDTH + '\' height=\'' + HEIGHT + '\'>' +
                        '<foreignObject width=\'100%\' height=\'100%\' x=\'0\' y=\'0\'>' +
                          '<style>' +
                            'x-row { display: block; }' +
                            'x-row:empty::before { content: \' \'; }' +
                          '</style>' +
                          src.replace(/^<body/, '<div').replace(/<\/body>$/, '</div>') +
                        '</foreignObject>' +
                      '</svg>';
                      img.onload = () => {
                        update(img);

                        cb && cb();
                      };
                      img.onerror = err => {
                        console.warn(err);
                      };

                      lastSrc = src;
                    } else {
                      cb && cb();
                    }
                  };

                  const terminalBuffer = (() => {
                    const result = document.createElement('div');
                    result.style = 'position: absolute; top: 0; bottom: 0; width: ' + WIDTH + 'px; height: ' + HEIGHT + 'px; overflow: hidden; visibility: hidden;';
                    return result;
                  })();
                  document.body.appendChild(terminalBuffer);

                  const term = (() => {
                    const result = new hterm.Terminal();
                    result.prefs_.set('audible-bell-sound', '');
                    result.prefs_.set('font-size', 14);
                    result.prefs_.set('cursor-color', '#FFFFFF');

                    result.scrollPort_.onResize = () => {}; // HACK: do not actualy listen for window resizes
                    result.decorate(terminalBuffer);

                    result.setCursorPosition(0, 0);
                    result.setCursorVisible(true);
                    result.prefs_.set('ctrl-c-copy', true);
                    result.prefs_.set('ctrl-v-paste', true);
                    result.prefs_.set('use-default-window-copy', true);

                    return result;
                  })();

                  const windowKeydown = e => {
                    if (e.keyCode === TILDE_KEY_CODE) {
                      term.focus();
                    }
                  };
                  input.addEventListener('keydown', windowKeydown);
                  const screenKeydown = e => {
                    if (e.keyCode === TILDE_KEY_CODE) {
                      if (document.activeElement === term.scrollPort_.iframe_) {
                        document.activeElement.blur();

                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }
                  };
                  term.scrollPort_.screen_.addEventListener('keydown', screenKeydown, true);

                  cleanups.push(() => {
                    input.removeEventListener('keydown', windowKeydown);
                    term.scrollPort_.screen_.removeEventListener('keydown', screenKeydown);
                  });

                  const socket = io(window.location.origin, {
                    path: '/archae/shell/socket.io',
                  })
                  let buf = '';

                  function Wetty(argv) {
                    this.argv_ = argv;
                    this.io = null;
                    this.pid_ = -1;
                  }
                  Wetty.prototype.run = function() {
                    this.io = this.argv_.io.push();

                    this.io.onVTKeystroke = this.sendString_.bind(this);
                    this.io.sendString = this.sendString_.bind(this);
                    this.io.onTerminalResize = this.onTerminalResize.bind(this);
                  }
                  Wetty.prototype.sendString_ = function(str) {
                    socket.emit('input', str);
                  };
                  Wetty.prototype.onTerminalResize = function(col, row) {
                    socket.emit('resize', { col: col, row: row });
                  };

                  socket.on('connect', function() {
                    lib.init(() => {
                      term.runCommandClass(Wetty/*, window.document.location.hash.substr(1)*/);
                      socket.emit('resize', {
                          col: term.screenSize.width,
                          row: term.screenSize.height
                      });

                      if (buf && buf != '')
                      {
                          term.io.writeUTF16(buf);
                          buf = '';
                      }

                      const html = terminalBuffer.childNodes[0].contentWindow.document.childNodes[0];
                      const body = html.childNodes[1];

                      let rendering = false;
                      let renderQueued = false;
                      const _queueRender = () => {
                        renderQueued = true;
                      };
                      const _listen = () => {
                        const observer = new MutationObserver(() => {
                          _queueRender();
                        }).observe(body, {
                          childList: true,
                          subtree: true,
                          attributes: true,
                          characterData: true,
                        });

                        const update = () => {
                          if (!rendering) {
                            rendering = true;

                            if (renderQueued) {
                              renderQueued = false;

                              _render(new XMLSerializer().serializeToString(body), () => {
                                rendering = false;
                              });
                            }
                          }
                        };
                        updates.push(update);

                        cleanups.push(() => {
                          observer.disconnect();
                          updates.splice(updates.indexOf(update), 1);
                        });
                      };

                      _queueRender();
                      _listen();
                    });
                  });

                  socket.on('output', function(data) {
                    if (!term) {
                      buf += data;
                      return;
                    }
                    term.io.writeUTF16(data);
                  });

                  socket.on('disconnect', function() {
                    console.log("Socket.io connection closed");
                  });

                  cleanups.push(() => {
                    socket.disconnect();
                  });

                  const _destroy = () => {
                    for (let i = 0; i < cleanups.length; i++) {
                      const cleanup = cleanups[i];
                      cleanup();
                    }
                    cleanups = [];
                  };

                  return {
                    destroy: _destroy,
                  };
                };

                const mesh = (() => {
                  const object = new THREE.Object3D();

                  const shellMesh = (() => {
                    const geometry = new THREE.PlaneBufferGeometry(MESH_WIDTH, MESH_HEIGHT, 1, 1);
                    const texture = (() => {
                      const texture = new THREE.Texture(
                        transparentImg,
                        THREE.UVMapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.LinearFilter,
                        THREE.LinearFilter,
                        THREE.RGBAFormat,
                        THREE.UnsignedByteType,
                        16
                      );
                      texture.needsUpdate = true;

                      const term = _connect({
                        update: (img) => {
                          texture.image = img;
                          texture.needsUpdate = true;
                        },
                      });

                      cleanups.push(() => {
                        term.destroy();
                      });

                      return texture;
                    })();
                    const material = new THREE.MeshBasicMaterial({
                      map: texture,
                    });

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.x = 0.5;
                    mesh.position.y = 1.5;
                    mesh.position.z = 0;
                    mesh.rotation.y = -(Math.PI / 2);
                    return mesh;
                  })();
                  object.add(shellMesh);

                  const boxMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(MESH_WIDTH, MESH_HEIGHT, 0.1);
                    const material = boxMeshMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.x = 0.5;
                    mesh.position.y = 1.5;
                    mesh.position.z = 0;
                    mesh.rotation.y = -(Math.PI / 2);
                    return mesh;
                  })();
                  object.add(boxMesh);

                  return object;
                })();
                scene.add(mesh);
                this.mesh = mesh;

                cleanups.push(() => {
                  scene.remove(mesh);
                });
              }

              destructor() {
                this._cleanup();
              }

              set position(matrix) {
                const {mesh} = this;

                mesh.position.set(matrix[0], matrix[1], matrix[2]);
                mesh.quaternion.set(matrix[3], matrix[4], matrix[5], matrix[6]);
                mesh.scale.set(matrix[7], matrix[8], matrix[9]);
              }
            }
          ],
          templates: [
            {
              tag: 'shell',
              attributes: {},
              children: [],
            },
          ],
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Shell;
