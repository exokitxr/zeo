const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');

const SIDES = ['left', 'right'];

const _makeId = () => Math.random().toString(36).substring(7);

class GlassVr {
  mount() {
    const {three: {THREE, scene, camera, renderer}, pose, input, render, items} = zeo;

    const _requestCanvasBlob = canvas => new Promise((accept, reject) => {
      canvas.toBlob(blob => {
        accept(blob);
      });
    });

    const forwardVector = new THREE.Vector3(0, 0, -1);
    const localVector = new THREE.Vector3();
    const localVector2 = new THREE.Vector3();

    const globalGlassState = {
      mode: null,
    };
    const _makeGlassState = () => ({
      highlight: 'audio',
    });
    const glassStates = {
      left: _makeGlassState(),
      right: _makeGlassState(),
    };

    const highlightSpecs = [
      {
        mode: 'picture',
        x: 0.25,
        y: 0.25,
        counterplanarSize: 0.1,
        coplanarSize: 0.25,
      },
      {
        mode: 'audio',
        x: 0.25,
        y: 0,
        counterplanarSize: 0.1,
        coplanarSize: 0.25,
      },
      {
        mode: 'video',
        x: 0.25,
        y: -0.25,
        counterplanarSize: 0.1,
        coplanarSize: 0.25,
      },
    ];

    const hudMesh = (() => {
      const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
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

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.5,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;

      const _align = (position, rotation, scale, lerpFactor) => {
        const targetPosition = position.clone().add(
          new THREE.Vector3(
            0,
            0,
            -0.5
          ).applyQuaternion(rotation)
        );
        const targetRotation = rotation;
        const distance = position.distanceTo(targetPosition);

        if (lerpFactor < 1) {
          mesh.position.add(
            targetPosition.clone().sub(mesh.position).multiplyScalar(distance * lerpFactor)
          );
          mesh.quaternion.slerp(targetRotation, lerpFactor);
          mesh.scale.copy(scale);
        } else {
          mesh.position.copy(targetPosition);
          mesh.quaternion.copy(targetRotation);
          mesh.scale.copy(scale);
        }
        mesh.updateMatrixWorld();
      };
      mesh.align = _align;

      const _render = () => {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = '#111';
        ctx.font = `50px Open Sans`;
        ctx.lineWidth = 5;

        const highlightIndex = highlightSpecs.findIndex(highlightSpec => SIDES.some(side => highlightSpec.mode === glassStates[side].highlight));
        if (!globalGlassState.mode) {
          ctx.fillText('Picture', WIDTH - 250, HEIGHT * 0.4);
          ctx.fillText('Audio', WIDTH - 250, HEIGHT * 0.6);
          ctx.fillText('Video', WIDTH - 250, HEIGHT * 0.8);

          if (highlightIndex !== -1) {
            ctx.strokeRect(WIDTH - 300, (HEIGHT * 0.2 * highlightIndex) + HEIGHT * 0.31, 300, HEIGHT * 0.11);
          }
        } else {
          ctx.fillStyle = '#F44336';
          ctx.beginPath();
          ctx.arc(WIDTH - HEIGHT * 0.045, HEIGHT * 0.045, HEIGHT * 0.04, 0, 2 * Math.PI);
          ctx.fill();

          if (highlightIndex !== -1) {
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(WIDTH - HEIGHT * 0.045, HEIGHT * 0.045, HEIGHT * 0.04, 0, 2 * Math.PI);
            ctx.stroke();
          }
        }

        texture.needsUpdate = true;
      };
      _render();
      mesh.render = _render;

      const {hmd: {worldPosition, worldRotation, worldScale}} = pose.getStatus();
      mesh.align(worldPosition, worldRotation, worldScale, 1);

      return mesh;
    })();
    scene.add(hudMesh);

    let cancelRecording = null;
    const _setMode = mode => {
      switch (mode) {
        case 'picture': {
          const {domElement: canvas} = renderer;

          _requestCanvasBlob(canvas)
            .then(blob => {
              const serverFile = items.makeServerFile(null, 'capture.png');
              serverFile.write(blob)
                .then(() => {
                  const dropMatrix = (() => {
                    const {hmd} = pose.getStatus();
                    const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmd;
                    localVector.copy(hmdPosition)
                      .add(
                        localVector2.copy(forwardVector).multiplyScalar(0.5)
                          .applyQuaternion(hmdRotation)
                      );
                    return localVector.toArray().concat(hmdRotation.toArray()).concat(hmdScale.toArray());
                  })();

                  const itemSpec = {
                    assetId: _makeId(),
                    id: _makeId(),
                    name: 'capture',
                    ext: 'png',
                    file: {
                      id: serverFile.n,
                      name: serverFile.name,
                    },
                    position: dropMatrix,
                    physics: true,
                    visible: true,
                    open: false,
                  };
                  items.makeItem(itemSpec);
                });
            })
            .catch(err => {
              console.warn(err);
            });

          break;
        }
        case 'audio': {
          let live = true;
          const cancels = [];
          cancelRecording = () => {
            for (let i = 0; i < cancels.length; i++) {
              const cancel = cancels[i];
              cancel();
            }
          };
          cancels.push(() => {
            live = false;

            globalGlassState.mode = null;
            hudMesh.render();
          });

          const serverFile = items.makeServerFile(null, 'capture.webm');
          let offset = 0;

          navigator.mediaDevices.getUserMedia({
            audio: true,
          })
            .then(mediaStream => {
              const mediaRecorder = new MediaRecorder(mediaStream, {
                mimeType: 'audio/webm',
              });
              mediaRecorder.ondataavailable = e => {
                const {data} = e;
                serverFile.write(data, {start: offset});
                offset += data.size;
              };
              mediaRecorder.onstop = () => {
                const dropMatrix = (() => {
                  const {hmd} = pose.getStatus();
                  const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmd;
                  localVector.copy(hmdPosition)
                    .add(
                      localVector2.copy(forwardVector).multiplyScalar(0.5)
                        .applyQuaternion(hmdRotation)
                    );
                  return localVector.toArray().concat(hmdRotation.toArray()).concat(hmdScale.toArray());
                })();

                const itemSpec = {
                  assetId: _makeId(),
                  id: _makeId(),
                  name: 'capture',
                  ext: 'webm',
                  file: {
                    id: serverFile.n,
                    name: serverFile.name,
                  },
                  position: dropMatrix,
                  physics: true,
                  visible: true,
                  open: false,
                };
                items.makeItem(itemSpec);
              };
              mediaRecorder.start(100);

              const cancelMedia = () => {
                const tracks = mediaStream.getTracks();
                for (let i = 0; i < tracks.length; i++) {
                  const track = tracks[i];
                  track.stop();
                }
                mediaRecorder.stop();
              };

              if (live) {
                cancels.push(cancelMedia);
              } else {
                cancelMedia();
              }
            })
            .catch(err => {
              console.warn(err);

              if (live) {
                cancelRecording();
                cancelRecording = null;
              }
            });

          globalGlassState.mode = 'audio';
          hudMesh.render();

          break;
        }
        case 'video': {
          let live = true;
          const cancels = [];
          cancelRecording = () => {
            for (let i = 0; i < cancels.length; i++) {
              const cancel = cancels[i];
              cancel();
            }
          };
          cancels.push(() => {
            live = false;

            globalGlassState.mode = null;
            hudMesh.render();
          });

          const serverFile = items.makeServerFile(null, 'capture.webm');
          let offset = 0;

          const {domElement: canvas} = renderer;
          const mediaStream = canvas.captureStream(25);
          const mediaRecorder = new MediaRecorder(mediaStream, {
            mimeType: 'video/webm',
          });
          mediaRecorder.ondataavailable = e => {
            const {data} = e;
            serverFile.write(data, {start: offset});
            offset += data.size;
          };
          mediaRecorder.onstop = () => {
            const dropMatrix = (() => {
              const {hmd} = pose.getStatus();
              const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmd;
              localVector.copy(hmdPosition)
                .add(
                  localVector2.copy(forwardVector).multiplyScalar(0.5)
                    .applyQuaternion(hmdRotation)
                );
              return localVector.toArray().concat(hmdRotation.toArray()).concat(hmdScale.toArray());
            })();

            const itemSpec = {
              assetId: _makeId(),
              id: _makeId(),
              name: 'capture',
              ext: 'webm',
              file: {
                id: serverFile.n,
                name: serverFile.name,
              },
              position: dropMatrix,
              physics: true,
              visible: true,
              open: false,
            };
            items.makeItem(itemSpec);
          };
          mediaRecorder.start(100);

          const cancelMedia = () => {
            const tracks = mediaStream.getTracks();
            for (let i = 0; i < tracks.length; i++) {
              const track = tracks[i];
              track.stop();
            }
            mediaRecorder.stop();
          };

          if (live) {
            cancels.push(cancelMedia);
          } else {
            cancelMedia();
          }

          globalGlassState.mode = 'video';
          hudMesh.render();

          break;
        }
      }
    };

    const _trigger = e => {
      const {side} = e;
      const glassState = glassStates[side];
      const {highlight} = glassState;

      if (highlight !== null) {
        const {mode: oldMode} = globalGlassState;

        if (oldMode === null) {
          _setMode(highlight);
        } else {
          cancelRecording();
          cancelRecording = null;
        }
      }
    };
    input.on('trigger', _trigger);

    let now = Date.now();
    let lastUpdateTime = now;
    const _update = () => {
      now = Date.now();

      const {hmd: {worldPosition, worldRotation, worldScale}} = pose.getStatus();
      const _updateHover = () => {
        const {gamepads} = pose.getStatus();
        const cameraPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(forwardVector.clone().applyQuaternion(worldRotation), worldPosition.clone());

        for (let s = 0; s < SIDES.length; s++) {
          const side = SIDES[s];
          const gamepad = gamepads[side];

          if (gamepad) {
            const {worldPosition: controllerPosition} = gamepad;
            const glassState = glassStates[side];

            const distanceSpecs = highlightSpecs.map(highlightSpec => {
              const {mode, x, y, counterplanarSize, coplanarSize} = highlightSpec;
              const highlightPosition = worldPosition.clone()
                .add(new THREE.Vector3(x, y).applyQuaternion(worldRotation));
              const counterplanarDistance = Math.abs(cameraPlane.distanceToPoint(controllerPosition));

              if (counterplanarDistance <= counterplanarSize) {
                const planePoint = cameraPlane.projectPoint(controllerPosition);
                const coplanarDistance = planePoint.distanceTo(highlightPosition);

                if (coplanarDistance <= coplanarSize) {
                  return {
                    mode,
                    distance: coplanarDistance,
                  };
                } else {
                  return null;
                }
              } else {
                return null;
              }
            }).filter(distanceSpec => distanceSpec !== null);

            if (distanceSpecs.length > 0) {
              const distanceSpec = distanceSpecs.sort((a, b) => a.distance - b.distance)[0];

              const {highlight: oldHighlight} = glassState;
              const {mode: newHighlight} = distanceSpec;

              if (newHighlight !== oldHighlight) {
                glassState.highlight = newHighlight;

                hudMesh.align(worldPosition, worldRotation, worldScale, 1);
                hudMesh.render();
              } else {
                const timeDiff = now - lastUpdateTime;
                const lerpFactor = timeDiff * 0.05;
                hudMesh.align(worldPosition, worldRotation, worldScale, lerpFactor);
              }

              hudMesh.visible = true;
            } else {
              const {highlight: oldHighlight} = glassState;
              const newHighlight = null;

              if (newHighlight !== oldHighlight) {
                glassState.highlight = null;

                hudMesh.render();
              }

              hudMesh.visible = Boolean(globalGlassState.mode);
            }
          }
        }
      };
      _updateHover();

      lastUpdateTime = now;
    };
    render.on('update', _update);

    this._cleanup = () => {
      scene.remove(hudMesh);

      input.removeListener('trigger', _trigger);
      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = GlassVr;
