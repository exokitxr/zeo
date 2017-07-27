class Stage {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
      img.src = src;
    });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/three',
        '/core/utils/js-utils',
      ]),
      _requestImage('/archae/stage/img/grid.png'),
    ]).then(([
      [
        three,
        jsUtils,
      ],
      gridImg,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const gridFloor = (() => {
          const geometry = new THREE.PlaneBufferGeometry(10, 10)
            .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 0, -1),
              new THREE.Vector3(0, 1, 0)
            )));

          const texture = new THREE.Texture(
            gridImg,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.NearestFilter,
            THREE.NearestFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
            1
          );
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaText: 0.5,
          });

          const mesh = new THREE.Mesh();
          return mesh;
        })();

        class StageApi {
          constructor() {
            this.stage = 'main';
            this.stages = {};
          }

          getStage() {
            return this.stage;
          }

          setStage(stage) {
            this.stage = stage;

            const {stage: oldStage} = this;

            const oldEntries = this.stages[oldStage];
            if (oldEntries) {
              for (let i = 0; i < oldEntries.length; i++) {
                const oldEntry = oldEntries[i];
                scene.remove(oldEntry);
              }
            }

            const newEntries = this.stages[stage];
            if (newEntries) {
              for (let i = 0; i < newEntry.length; i++) {
                const newEntry = newEntries[i];
                scene.add(newEntry);
              }
            }
          }

          add(stage, object) {
            let entries = this.stages[stage];
            if (!entries) {
              entries = [];
              this.stages[stage] = entries;
            }
            entries.push(object);

            if (this.stage === stage) {
              scene.add(object);
            }
          }

          remove(stage, object) {
            const entries = this.stages[stage];
            if (entries) {
              const index = entries.indexOf(stage);

              if (index !== -1) {
                entries.splice(index, 1);
              }
              if (entries.length === 0) {
                delete this.stages[stage];
              }
            }

            if (this.stage === stage) {
              scene.remove(object);
            }
          }

          destroy() {
            const entries = this.stages[this.stage];

            if (entries) {
              for (let i = 0; i < v.length; i++) {
                const entry = entries[i];
                scene.remove(entry);
              }
            }
          }
        }
        const stageApi = new StageApi();
        stageApi.add('blank', floorGrid);

        this._cleanup = () => {
          stageApi.destroy();
        };

        return stageApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Stage;
