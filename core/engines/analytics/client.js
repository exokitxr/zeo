const SIDES = ['left', 'right'];

class Analytics {
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
      '/core/engines/rend',
    ])
      .then(([
        three,
        webvr,
        rend,
      ]) => {
        const {THREE} = three;

        const hmdTrackers = [];
        const controllerTrackers = [];
        const cameraTrackers = [];

        class Tracker {
          constructor(label) {
            this.label = label;

            this.value = 0;
            this.numFrames = 0;
          }

          tick(value) {
            this.value += value;
            this.numFrames++;
          }
        }

        class HmdTracker extends Tracker {
          constructor(label) {
            super(label);

            this.position = new THREE.Vector3();
          }

          setPosition(position) {
            this.position.copy(position);
          }
        }

        class ControllerTracker extends Tracker {
          constructor(label) {
            super(label);

            this.position = new THREE.Vector3();
            this.numControllers = 1;
          }

          setPosition(position) {
            this.position.copy(position);
          }

          setNumControllers(numControllers) {
            if (numControllers === 1 || numControllers === 2) {
              this.numControllers = numControllers;
            } 
          }
        }

        class CameraTracker extends Tracker {
          constructor(label) {
            super(label);

            this.position = new THREE.Vector3();
          }

          setPosition(position) {
            this.position.copy(position);
          }
        }

        const _getHmdTracker = label => {
          const hmdTracker = new HmdTracker(label);
          hmdTrackers.push(hmdTracker);
          return hmdTracker;
        };
        const _getControllerTracker = label => {
          const controllerTracker = new ControllerTracker(label);
          controllerTrackers.push(controllerTracker);
          return controllerTracker;
        };
        const _getCameraTracker = label => {
          const cameraTracker = new CameraTracker(label);
          cameraTrackers.push(cameraTracker);
          return cameraTracker;
        };

        const _averageTrackers = trackers => {
          const valueAcc = {};
          const frameAcc = {};
          for (let i = 0; i < hmdTrackers.length; i++) {
            const hmdTracker = hmdTrackers[i];
            const {label, value, numFrames} = hmdTracker;

            if (valueAcc[label] === undefined) {
              valueAcc[label] = 0;
            }
            valueAcc[label] += value;

            if (frameAcc[label] === undefined) {
              frameAcc[label] = 0;
            }
            frameAcc[label] += numFrames;
          }

          return _averageValues(valueAcc, frameAcc);
        };
        const _averageValues = (values, frames) => {
          const result = {};
          for (const k in values) {
            result[k] = values[k] / frames[k];
          }
          return result;
        };
        const _getValues = () => {
          const hmd = _averageTrackers(hmdTrackers);
          const controller = _averageTrackers(controllerTrackers);
          const camera = _averageTrackers(cameraTrackers);

          return {
            hmd,
            controller,
            camera,
          };
        };

        const _update = () => {
          const {hmd, gamepads} = webvr.getStatus();
          const activeGamepads = SIDES
            .map(side => gamepads[side] || null)
            .filter(gamepad => gamepad !== null);

          for (let i = 0; i < hmdTrackers.length; i++) {
            const hmdTracker = hmdTrackers[i];
            const distance = hmd.position.distanceTo(hmdTracker.position);
            hmdTracker.tick(distance);
          }
          if (activeGamepads.length > 0) {
            for (let i = 0; i < controllerTrackers.length; i++) {
              const controllerTracker = controllerTrackers[i];
              const {numControllers} = controllerTracker;

              if (numControllers === 1) {
                let minAcc = Infinity;
                for (let j = 0; j < activeGamepads.length; j++) {
                  const activeGamepad = activeGamepads[j];
                  minAcc = Math.min(activeGamepad.position.distanceTo(controllerTracker.position), minAcc);
                }
                controllerTracker.tick(minAcc);
              } else if (numControllers === 2) {
                let sumAcc = 0;
                for (let j = 0; j < activeGamepads.length; j++) {
                  const activeGamepad = activeGamepads[j];
                  sumAcc += activeGamepad.position.distanceTo(controllerTracker.position);
                }
                controllerTracker.tick(sumAcc / activeGamepads.length);
              } else {
                throw new Error('illegal number of controllers');
              }
            }
          }
          for (let i = 0; i < cameraTrackers.length; i++) {
            const cameraTracker = cameraTrackers[i];
            const requiredRotation = new THREE.Quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 0, -1),
              cameraTracker.position.clone().sub(hmd.position).normalize()
            );
            const angle = (2 * Math.acos(hmd.rotation.clone().multiply(requiredRotation.clone().inverse()).x)) % Math.PI;
            cameraTracker.tick(angle);
          }
        };
        rend.on('update', _update);

        this._cleanup = () => {
          rend.removeListener('update', _update);
        };

        return {
          getHmdTracker: _getHmdTracker,
          getControllerTracker: _getControllerTracker,
          getCameraTracker: _getCameraTracker,
          getValues: _getValues,
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Analytics;
