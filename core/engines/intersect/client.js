const GPUPickerLib = require('./lib/three-extra/GPUPicker.js');

const NUM_POSITIONS = 4096;

const SIDES = ['left', 'right'];
const AXES = ['x', 'y', 'z'];

class Intersect {
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
    ]).then(([
      three,
      webvr,
      rend,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const GPUPicker = GPUPickerLib(THREE);

        const forwardVector = new THREE.Vector3(0, 0, -1);

        const _makeHoverState = () => ({
          object: null,
          originalObject: null,
          position: null,
          normal: null,
          index: null,
        });

        class Intersecter {
          constructor({frameRate, intersectMeshKey, debug}) {
            this.frameRate = frameRate;
            this.intersectMeshKey = intersectMeshKey;
            this.lastUpdateTime = Date.now() - (Math.random() * frameRate); // try to avoid synchronization across intersecters

            const pickerScene = new THREE.Scene();
            pickerScene.autoUpdate = false;
            this.pickerScene = pickerScene;

            const pickerRenderer = new THREE.WebGLRenderer();
            pickerRenderer.setSize(64, 64);
            pickerRenderer.setClearColor(0xffffff, 1);
            pickerRenderer.sortObjects = false;
            this.pickerRenderer = pickerRenderer;

            const gpuPicker = new GPUPicker();
            gpuPicker.setRenderer(pickerRenderer);
            if (debug) {
              const debugRenderer = new THREE.WebGLRenderer(); // for debugging
              debugRenderer.setSize(64, 64);
              debugRenderer.setClearColor(0xffffff, 1);
              debugRenderer.sortObjects = false;
              debugRenderer.domElement.style.cssText = 'position: absolute; top: 0; right: 0;';
              document.body.appendChild(debugRenderer.domElement);
              gpuPicker.debugRenderer = debugRenderer;
            }
            const pickerCamera = new THREE.PerspectiveCamera();
            pickerScene.add(pickerCamera);
            gpuPicker.setCamera(pickerCamera);
            gpuPicker.setScene(pickerScene);
            this.gpuPicker = gpuPicker;

            const hoverStates = {
              left: _makeHoverState(),
              right: _makeHoverState(),
            };
            this.hoverStates = hoverStates;
          }

          getHoverState(side) {
            return this.hoverStates[side];
          }

          addTarget(object) {
            const intersectMesh = object.clone();
            object[this.intersectMeshKey] = intersectMesh;
            intersectMesh.originalObject = object;

            this.pickerScene.add(intersectMesh);
          }

          removeTarget(object) {
            const intersectMesh = object[this.intersectMeshKey];

            this.pickerScene.remove(intersectMesh);

            _destroyIntersectMesh(intersectMesh);
            object[this.intersectMeshKey] = null;
          }

          destroyTarget(object) {
            _destroyTargetObject(object);
          }

          reindex() {
            this.gpuPicker.reindexScene();
          }

          update(side) {
            const sides = typeof side === 'string' ? [side] : SIDES;

            const {frameRate, lastUpdateTime} = this;
            const now = Date.now();
            const timeDiff = now - lastUpdateTime;

            if (timeDiff >= frameRate) {
              const {gpuPicker, hoverStates} = this;
              const {hmd, gamepads} = webvr.getStatus();

              sides.forEach(side => {
                const gamepad = gamepads[side];
                const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                const hoverState = hoverStates[side];

                gpuPicker.camera.position.copy(controllerPosition);
                gpuPicker.camera.quaternion.copy(controllerRotation);
                gpuPicker.camera.updateMatrixWorld(true);
                gpuPicker.needUpdate = true;
                gpuPicker.update();

                const intersection = gpuPicker.pick();

                const _clear = () => {
                  hoverState.object = null;
                  hoverState.originalObject = null;
                  hoverState.position = null;
                  hoverState.normal = null;
                  hoverState.index = null;
                };

                if (intersection) {
                  const {object, index} = intersection;
                  const positions = object.geometry.attributes.position.array;
                  const baseIndex = index * 9;
                  const va = new THREE.Vector3().fromArray(positions, baseIndex + 0).applyMatrix4(object.matrixWorld);
                  const vb = new THREE.Vector3().fromArray(positions, baseIndex + 3).applyMatrix4(object.matrixWorld);
                  const vc = new THREE.Vector3().fromArray(positions, baseIndex + 6).applyMatrix4(object.matrixWorld);
                  const triangle = new THREE.Triangle(va, vb, vc);
                  const position = new THREE.Ray(
                    controllerPosition.clone(),
                    forwardVector.clone().applyQuaternion(controllerRotation)
                  ).intersectPlane(triangle.plane());

                  if (position) {
                    const normal = triangle.normal();
                    const originalObject = (() => {
                      let o;
                      for (o = object; o && !o.originalObject; o = o.parent) {}
                      return o && o.originalObject;
                    })();

                    hoverState.object = object;
                    hoverState.originalObject = originalObject;
                    hoverState.position = position;
                    hoverState.normal = normal;
                    hoverState.index = index;
                  } else {
                    _clear();
                  }
                } else {
                  _clear();
                }
              });

              this.lastUpdateTime = now;
            }
          }

          destroy() {
            this.pickerRenderer.dispose();
            _destroyIntersectMesh(this.pickerScene);
          }
        }

        const _makeIntersecter = ({
          frameRate = 50,
          intersectMeshKey = '_intersectMesh',
          debug = false,
        } = {}) => new Intersecter({
          frameRate,
          intersectMeshKey,
          debug,
        });
        const _destroyIntersecter = intersecter => intersecter.destroy();

        return {
          makeIntersecter: _makeIntersecter,
          destroyIntersecter: _destroyIntersecter,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
};
const _destroyIntersectMesh = object => {
  if (object.geometry && object.geometry.__pickingGeometry) {
    object.geometry.__pickingGeometry.dispose();
    object.geometry.__pickingGeometry = null;
  }

  if (object.__pickingMaterial) {
    object.__pickingMaterial.dispose();
    object.__pickingMaterial = null;
  }

  for (let i = 0; i < object.children.length; i++) {
    _destroyIntersectMesh(object.children[i]);
  }
};

module.exports = Intersect;
