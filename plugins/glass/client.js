const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');
const menuRenderer = require('./lib/render/menu');

const SIDES = ['left', 'right'];

class Glass {
  mount() {
    const {three: {THREE, scene, camera, renderer}, pose, input, render, ui} = zeo;

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const forwardVector = new THREE.Vector3(0, 0, -1);

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

    const hudMesh = (() => {
      const menuUi = ui.makeUi({
        width: WIDTH,
        height: HEIGHT,
        color: [1, 1, 1, 0],
      });
      const mesh = menuUi.makePage(({
        globalGlassState,
        glassStates,
      }) => {
        const {mode} = globalGlassState;
        const highlights = [glassStates.left.highlight, glassStates.right.highlight];

        return {
          type: 'html',
          src: menuRenderer.getHudSrc({mode, highlights}),
          x: 0,
          y: 0,
          w: WIDTH,
          h: HEIGHT,
        };
      }, {
        type: 'glass',
        state: {
          globalGlassState,
          glassStates,
        },
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
      });
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
      };
      mesh.align = _align;

      const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
      mesh.align(cameraPosition, cameraRotation, cameraScale, 1);

      const {page} = mesh;
      page.initialUpdate();

      return mesh;
    })();
    scene.add(hudMesh);

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

    let cancelRecording = null;
    const _setMode = mode => {
      switch (mode) {
        case 'picture': {
          const {domElement: canvas} = renderer;
          const dataUrl = canvas.toDataURL();

console.log('save picture', dataUrl.length); // XXX

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
            const {page} = hudMesh;
            page.update();
          });

          navigator.mediaDevices.getUserMedia({
            audio: true,
          })
            .then(mediaStream => {
              const mediaRecorder = new MediaRecorder(mediaStream, {
                mimeType: 'audio/webm',
              });
              mediaRecorder.ondataavailable = e => {
                const {data} = e;
console.log('save audio', data.size); // XXX
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
          const {page} = hudMesh;
          page.update();

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
            const {page} = hudMesh;
            page.update();
          });

          navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          })
            .then(mediaStream => {
              const mediaRecorder = new MediaRecorder(mediaStream, {
                mimeType: 'video/webm',
              });
              mediaRecorder.ondataavailable = e => {
                const {data} = e;
console.log('save video', data.size); // XXX
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

          globalGlassState.mode = 'video';
          const {page} = hudMesh;
          page.update();

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

      const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
      const _updateHudMesh = () => {
        const timeDiff = now - lastUpdateTime;
        const lerpFactor = timeDiff * 0.005;
        hudMesh.align(cameraPosition, cameraRotation, cameraScale, lerpFactor);

        if (!hudMesh.visible) {
          hudMesh.visible = true;
        }
      };
      const _updateHover = () => {
        const {gamepads} = pose.getStatus();
        const cameraPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(forwardVector.clone().applyQuaternion(cameraRotation), cameraPosition.clone());

        SIDES.forEach(side => {
          const gamepad = gamepads[side];

          if (gamepad) {
            const {worldPosition: controllerPosition} = gamepad;
            const glassState = glassStates[side];

            const distanceSpecs = highlightSpecs.map(highlightSpec => {
              const {mode, x, y, counterplanarSize, coplanarSize} = highlightSpec;
              const highlightPosition = cameraPosition.clone()
                .add(new THREE.Vector3(x, y).applyQuaternion(cameraRotation));
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

                const {page} = hudMesh;
                page.update();
              }
            } else {
              const {highlight: oldHighlight} = glassState;
              const newHighlight = null;

              if (newHighlight !== oldHighlight) {
                glassState.highlight = null;

                const {page} = hudMesh;
                page.update();
              }
            }
          }
        });
      };

      _updateHudMesh();
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

module.exports = Glass;
