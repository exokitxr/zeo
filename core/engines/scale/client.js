const SIDES = ['left', 'right'];

class Scale {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/input',
      '/core/engines/rend',
      '/core/engines/cyborg',
    ]).then(([
      three,
      webvr,
      input,
      rend,
      cyborg,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {
            position,
            rotation,
            scale,
          };
        };
        const _avgVectors = a => {
          const result = new THREE.Vector3();
          for (let i = 0; i < a.length; i++) {
            const e = a[i];
            result.add(e);
          }
          result.divideScalar(a.length);
          return result;
        };

        const _makeScaleState = () => ({
          gripStart: null,
        });
        const scaleStates = {
          left: _makeScaleState(),
          right: _makeScaleState(),
        };

        const scaleState = {
          startScaleMid: null,
          startStageMatrix: null,
        };

        const _gripdown = e => {
          const {side} = e;
          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads[side];

          if (gamepad) {
            const scaleState = scaleStates[side];
            scaleState.gripStart = new THREE.Vector3().fromArray(gamepad.pose.position);
          }
        };
        input.on('gripdown', _gripdown);
        const _gripup = e => {
          const {side} = e;
          const scaleState = scaleStates[side];

          scaleState.gripStart = null;
        };
        input.on('gripup', _gripup);

        const _update = () => {
          const scaling = SIDES.every(side => scaleStates[side].gripStart !== null);

          if (scaling) {
            const {gamepads} = webvr.getStatus();
            const haveGamepads = SIDES.every(side => Boolean(gamepads[side]));

            if (haveGamepads) {
              const scaleMid = _avgVectors(SIDES.map(side => new THREE.Vector3().fromArray(gamepads[side].pose.position)));

              let {startScaleMid, startStageMatrix} = scaleState;
              if (!startScaleMid) {
                startScaleMid = scaleMid;
                scaleState.startScaleMid = scaleMid;
              }
              if (!startStageMatrix) {
                startStageMatrix = _decomposeMatrix(webvr.getStageMatrix());
                scaleState.startStageMatrix = startStageMatrix;
              }

              const scaleMidDiff = scaleMid.clone().sub(startScaleMid);
              const {position, rotation, scale} = startStageMatrix;
              const newPosition = position.clone().sub(scaleMidDiff.clone().applyQuaternion(rotation));
              const newStageMatrix = new THREE.Matrix4().compose(newPosition, rotation, scale);
              webvr.setStageMatrix(newStageMatrix);

              // webvr.updateStatus();
              // webvr.updateUserStageMatrix();
              // cyborg.update();
            } else {
              scaleState.startScaleMid = null;
              scaleState.startStageMatrix = null;
            }
          } else {
            scaleState.startScaleMid = null;
            scaleState.startStageMatrix = null;
          }
        };
        rend.on('update', _update);

        this._cleanup = () => {
          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);

          rend.removeListener('update', _update);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Scale;
