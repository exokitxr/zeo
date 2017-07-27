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
        '/core/engines/webvr',
        '/core/utils/js-utils',
      ]),
      _requestImage('/archae/stage/img/grid.png'),
    ]).then(([
      [
        three,
        webvr,
        jsUtils,
      ],
      gridImg,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const floorGridMesh = (() => {
          const geometry = new THREE.PlaneBufferGeometry(10, 10)
            .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 0, -1),
              new THREE.Vector3(0, 1, 0)
            )));
          const uvs = geometry.getAttribute('uv').array;
          const numUvs = uvs.length / 2;
          for (let i = 0; i < numUvs; i++) {
            uvs[i * 2 + 0] *= 20;
            uvs[i * 2 + 1] *= 20;
          }

          const texture = new THREE.Texture(
            gridImg,
            THREE.UVMapping,
            THREE.RepeatWrapping,
            THREE.RepeatWrapping,
            THREE.NearestFilter,
            THREE.NearestFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
            1
          );
          texture.needsUpdate = true;
          const material = new THREE.MeshBasicMaterial({
            // color: 0x0000FF,
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.5,
          });

          const mesh = new THREE.Mesh(geometry, material);
          return mesh;
        })();
        renderer.compile(floorGridMesh, camera);

        class StageApi extends EventEmitter {
          constructor() {
            super();

            this.stage = 'main';
            this.stages = {};
          }

          getStage() {
            return this.stage;
          }

          setStage(stage) {
            const oldStage = this.stages[this.stage];
            if (oldStage) {
              scene.remove(oldStage);
            }

            const newStage = this.stages[stage];
            if (newStage) {
              scene.add(newStage);
            }

            this.stage = stage;

            this.emit('stage', stage);
          }

          add(stage, object) {
            let stageObject = this.stages[stage];
            if (!stageObject) {
              stageObject = new THREE.Object3D();
              this.stages[stage] = stageObject;

              if (stage === this.stage) {
                scene.add(stageObject);
              }
            }
            stageObject.add(object);
          }

          remove(stage, object) {
            const stageObject = this.stages[stage];
            if (stageObject) {
              stageObject.remove(object);
            }
            if (stageObject.children.length === 0) {
              delete this.stages[stage];

              if (stage === this.stage) {
                scene.remove(stageObject);
              }
            }
          }

          destroy() {
            for (const stage in this.stageObjects) {
              const stageObject = this.stageObjects[stage];
              scene.remove(stageObject);
            }
          }
        }
        const stageApi = new StageApi();
        stageApi.add('blank', floorGridMesh);
        stageApi.on('stage', stage => {
          if (stage === 'blank') {
            const stageMatrix = webvr.getStageMatrix();
            stageMatrix.decompose(
              floorGridMesh.position,
              floorGridMesh.rotation,
              floorGridMesh.scale
            );
            floorGridMesh.matrix.copy(stageMatrix);
            floorGridMesh.matrixWorld.multiplyMatrices(floorGridMesh.parent.matrixWorld, stageMatrix);
          }
        });


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
