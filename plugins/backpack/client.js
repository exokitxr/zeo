class Backpack {
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
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        const mesh = (() => {
          const width = 0.5;
          const height = 0.1;
          const depth = 0.35;
          const thickness = 0.01;

          const outerMaterial = new THREE.MeshPhongMaterial({
            color: 0x333333,
          });
          const innerMaterial = new THREE.MeshPhongMaterial({
            color: 0x795548,
          });

          const object = new THREE.Mesh();
          object.position.set(1, 1, 0);

          const bottom = new THREE.Mesh(
            new THREE.BoxBufferGeometry(width, thickness, depth)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, -(height / 2), 0)),
            outerMaterial
          );
          object.add(bottom);

          const top = new THREE.Mesh(
            new THREE.BoxBufferGeometry(width, thickness, depth)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, depth / 2))
              .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 4))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, height / 2, -(depth / 2))),
            outerMaterial
          );
          object.add(top);

          const left = new THREE.Mesh(
            new THREE.BoxBufferGeometry(thickness, height - (thickness), depth)
              .applyMatrix(new THREE.Matrix4().makeTranslation(-(width / 2) + (thickness / 2), 0, 0)),
            outerMaterial
          );
          object.add(left);

          const right = new THREE.Mesh(
            new THREE.BoxBufferGeometry(thickness, height - (thickness), depth)
              .applyMatrix(new THREE.Matrix4().makeTranslation((width / 2) - (thickness / 2), 0, 0)),
            outerMaterial
          );
          object.add(right);

          const back = new THREE.Mesh(
            new THREE.BoxBufferGeometry(width, height - (thickness), thickness)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -(depth / 2) + (thickness / 2))),
            outerMaterial
          );
          object.add(back);

          const front = new THREE.Mesh(
            new THREE.BoxBufferGeometry(width, height - (thickness), thickness)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, (depth / 2))),
            outerMaterial
          );
          object.add(front);

          const handleFront = new THREE.Mesh(
            new THREE.BoxBufferGeometry(0.1, 0.01, 0.01)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, (depth / 2) + 0.05)),
            outerMaterial
          );
          object.add(handleFront);

          const handleLeft = new THREE.Mesh(
            new THREE.BoxBufferGeometry(0.01, 0.01, 0.05)
              .applyMatrix(new THREE.Matrix4().makeTranslation(-(0.1 / 2) - (0.01 / 2), 0, (depth / 2) + (0.05 / 2) + (0.01 / 2))),
            outerMaterial
          );
          object.add(handleLeft);

          const handleRight = new THREE.Mesh(
            new THREE.BoxBufferGeometry(0.01, 0.01, 0.05)
              .applyMatrix(new THREE.Matrix4().makeTranslation((0.1 / 2) + (0.01 / 2), 0, (depth / 2) + (0.05 / 2) + (0.01 / 2))),
            outerMaterial
          );
          object.add(handleRight);

          /* const lid = new THREE.Mesh(
            new THREE.BoxBufferGeometry(width, thickness, depth / 2)
              .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, height, 0)),
            outerMaterial
          );
          object.add(lid); */

          return object;
        })();
        scene.add(mesh);

        this._cleanup = () => {
          scene.remove(mesh);
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Backpack;
