const htermAll = require('./lib/wetty/hterm_all');
const {hterm, lib} = htermAll;
const io = require('./lib/socket.io-client/socket.io.js');

hterm.defaultStorage = new lib.Storage.Local();
lib.ensureRuntimeDependencies_ = () => {}; // HACK: elide the check, because it just checks for globals exposure

const WIDTH = 1280;
const HEIGHT = 1024;
const ASPECT_RATIO = WIDTH / HEIGHT;
const MESH_WIDTH = 1;
const MESH_HEIGHT = MESH_WIDTH / ASPECT_RATIO;
const MESH_DEPTH = MESH_WIDTH / 50;

const BOX_MESH_COLOR = 0x808080;
const BOX_MESH_HOVER_COLOR = 0x0000FF;
const BOX_MESH_FOCUS_COLOR = 0x00FF00;

const SIDES = ['left', 'right'];

class Shell {
  mount() {
    const {three: {THREE}, elements, pose, input, render, ui} = zeo;

    const transparentImg = ui.getTransparentImg();

    const _decomposeObjectMatrixWorld = object => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      object.matrixWorld.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const updates = [];
    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        update();
      }
    };

    const shellComponent = {
      selector: 'shell[position]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElenent) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const cleanups = [];
        entityApi._cleanup = () => {
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

                cb();
              };
              img.onerror = err => {
                console.warn(err);

                cb();
              };

              lastSrc = src;
            } else {
              cb();
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

            // HACK: do not handle requests to focus or window resizes
            result.scrollPort_.focus = () => {};
            result.scrollPort_.onResize = () => {};
            result.decorate(terminalBuffer);

            result.setCursorPosition(0, 0);
            result.setCursorVisible(true);
            result.prefs_.set('ctrl-c-copy', true);
            result.prefs_.set('ctrl-v-paste', true);
            result.prefs_.set('use-default-window-copy', true);

            return result;
          })();

          const keypress = e => {
            if (_isFocused()) {
              if (e.keyCode === 192 && (e.ctrlKey || e.metaKey)) { // (ctrl|meta)-`
                focusState.focused = false;
              } else if (!(e.keyCode === 82 && (e.ctrlKey || e.metaKey))) {// (ctrl|meta)-R
                term.keyboard.onKeyPress_(e);
              }

              e.stopImmediatePropagation();
            }
          };
          input.on('keypress', keypress, {
            priority: 1,
          });
          const keydown = e => {
            if (_isFocused()) {
              if (e.keyCode === 192 && (e.ctrlKey || e.metaKey)) { // (ctrl|meta)-`
                focusState.focused = false;
              } else if (!(e.keyCode === 82 && (e.ctrlKey || e.metaKey))) {// (ctrl|meta)-R
                term.keyboard.onKeyDown_(e);
              }

              e.stopImmediatePropagation();
            }
          };
          input.on('keydown', keydown, {
             priority: 1,
          });
          const keyup = e => {
            if (_isFocused()) {
              if (e.keyCode === 192 && (e.ctrlKey || e.metaKey)) { // (ctrl|meta)-`
                focusState.focused = false;
              } else if (!(e.keyCode === 82 && (e.ctrlKey || e.metaKey))) {// (ctrl|meta)-R
                term.keyboard.onKeyUp_(e);
              }

              e.stopImmediatePropagation();
            }
          };
          input.on('keyup', keyup, {
            priority: 1,
          });
          const trigger = e => {
            const {side} = e;
            const hoverState = hoverStates[side];
            const {hovered} = hoverState;

            if (hovered) {
              focusState.focused = true;
            }
          };
          input.on('trigger', trigger);
          const grip = e => {
            focusState.focused = false;
          };
          input.on('grip', grip);

          cleanups.push(() => {
            input.removeListener('keypress', keypress);
            input.removeListener('keydown', keydown);
            input.removeListener('keyup', keyup);
            input.removeListener('trigger', trigger);
            input.removeListener('grip', grip);
          });

          const socket = io(window.location.origin, {
            path: 'archae/shell/socket.io',
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

              if (buf && buf != '') {
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
                });
                observer.observe(body, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  characterData: true,
                });

                const update = () => {
                  if (!rendering && renderQueued) {
                    rendering = true;
                    renderQueued = false;

                    _render(new XMLSerializer().serializeToString(body), () => {
                      rendering = false;
                    });
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
          object.shellMesh = shellMesh;

          const boxMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(MESH_WIDTH, MESH_HEIGHT, 0.1);
            const material = new THREE.MeshBasicMaterial({
              color: BOX_MESH_COLOR,
              wireframe: true,
              // opacity: 0.5,
              // transparent: true,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.x = 0.5;
            mesh.position.y = 1.5;
            mesh.position.z = 0;
            mesh.rotation.y = -(Math.PI / 2);
            return mesh;
          })();
          object.add(boxMesh);
          object.boxMesh = boxMesh;

          return object;
        })();
        entityObject.add(mesh);
        entityApi.mesh = mesh;

        const _makeHoveredState = () => ({
          hovered: false,
        });
        const hoverStates = {
          left: _makeHoveredState(),
          right: _makeHoveredState(),
        };
        const focusState = {
          focused: false,
        };

        const _isHovered = () => SIDES.some(side => hoverStates[side].hovered);
        const _isFocused = () => focusState.focused;

        const update = () => {
          const {shellMesh, boxMesh} = mesh;

          const {position: shellPosition, rotation: shellRotation} = _decomposeObjectMatrixWorld(shellMesh);
          const shellPlane = (() => {
            const shellNormalZ = new THREE.Vector3(0, 0, 1).applyQuaternion(shellRotation);
            return new THREE.Plane().setFromNormalAndCoplanarPoint(shellNormalZ, shellPosition);
          })();

          const _updateControllers = () => {
            const {gamepads} = pose.getStatus();

            SIDES.forEach(side => {
              const gamepad = gamepads[side];
              const hoverState = hoverStates[side];

              if (gamepad) {
                const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;
                const absPosition = controllerPosition.clone().multiply(controllerScale);
                const ray = new THREE.Vector3(0, 0, -10)
                  .applyQuaternion(controllerRotation);
                const controllerLine = new THREE.Line3(
                  absPosition.clone(),
                  absPosition.clone().add(ray.clone().multiplyScalar(15))
                );
                const shellIntersectionPoint = shellPlane.intersectLine(controllerLine);
                if (shellIntersectionPoint) {
                  const _makeShellPoint = (x, y, z) => shellPosition.clone()
                    .add(
                      new THREE.Vector3(
                        -MESH_WIDTH / 2,
                        MESH_HEIGHT / 2,
                        0
                      )
                      .add(
                        new THREE.Vector3(
                          (x / WIDTH) * MESH_WIDTH,
                          (-y / HEIGHT) * MESH_HEIGHT,
                          z
                        )
                      ).applyQuaternion(shellRotation)
                    );

                  const shellBox = new THREE.Box3().setFromPoints([
                    _makeShellPoint(0, 0, -MESH_DEPTH),
                    _makeShellPoint(WIDTH, HEIGHT, MESH_DEPTH),
                  ]);
                  hoverState.hovered = shellBox.containsPoint(shellIntersectionPoint);
                } else {
                  hoverState.hovered = false;
                }
              } else {
                hoverState.hovered = false;
              }
            });
          };
          const _updateMesh = () => {
            if (_isFocused()) {
              boxMesh.material.color.set(BOX_MESH_FOCUS_COLOR);
            } else {
              if (_isHovered()) {
                boxMesh.material.color.set(BOX_MESH_HOVER_COLOR);
              } else {
                boxMesh.material.color.set(BOX_MESH_COLOR);
              }
            }
          };

          _updateControllers();
          _updateMesh();
        };
        updates.push(update);

        cleanups.push(() => {
          entityObject.remove(mesh);

          updates.splice(updates.indexOf(update), 1);
        });
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'position': {
            const {mesh} = entityApi;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            mesh.scale.set(newValue[7], newValue[8], newValue[9]);
          }
        };
      },
    };
    elements.registerComponent(this, shellComponent);

    render.on('update', _update);

    this._cleanup = () => {
      elements.unregisterComponent(this, shellComponent);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Shell;
