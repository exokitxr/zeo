const modelPath = '/archae/models/hmd/hmd.json';

class Hmd {
  mount() {
    const {three: {THREE, scene, camera}} = zeo;

    class Hmd {
      constructor(index) {
        this._index = index;

        const mesh = (() => {
          const result = new THREE.Object3D();

          const inner = (() => {
            const object = new THREE.Object3D();

            const loader = new THREE.ObjectLoader();
            loader.crossOrigin = true;
            loader.load(modelPath, mesh => {
              mesh.scale.set(0.045, 0.045, 0.045);
              mesh.rotation.order = camera.rotation.order;
              mesh.rotation.y = Math.PI;

              // const loader = new THREE.TextureLoader();
              // const model = mesh.children[0];
              // model.material.color.setHex(0xFFFFFF);
              // model.material.map = loader.load(texturePath);
              // model.material.specularMap = loader.load(specularMapPath);

              object.add(mesh);
            });

            const tip = (() => {
              const result = new THREE.Object3D();
              result.position.z = -1;
              return result;
            })();
            object.add(tip);
            object.tip = tip;

            return object;
          })();
          result.add(inner);
          result.inner = inner;

          return result;
        })();
        scene.add(mesh);
        this.mesh = mesh;
      }

      update() {
        const {mesh} = this;

        const cameraPosition = new THREE.Vector3();
        const cameraRotation = new THREE.Quaternion();
        const cameraScale = new THREE.Vector3();

        camera.updateMatrixWorld();
        camera.matrixWorld.decompose(cameraPosition, cameraRotation, cameraScale);

        mesh.position.copy(
          cameraPosition.clone()
            .add(
              new THREE.Vector3(
                0,
                0,
                0
              )
              .applyQuaternion(cameraRotation)
            )
        );
        mesh.quaternion.copy(cameraRotation);
      }

      destroy() {
        const {mesh} = this;

        scene.remove(mesh);
      }
    }

    const hmd = new Hmd();

    this._cleanup = () => {
      hmd.destroy();
    };
  }

  unount() {
    this._cleanup();
  }
}

module.exports = Hmd;
