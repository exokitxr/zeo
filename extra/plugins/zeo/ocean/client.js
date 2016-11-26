class Ocean {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    this._cleanup = () => {};

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      const {THREE, scene} = zeo;
      const world = zeo.getCurrentWorld();

      const planeMesh = (() => {
        const geometry = new THREE.PlaneBufferGeometry(200, 200, 200 / 2, 200 / 2);
        geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0));

        const material = new THREE.MeshBasicMaterial({
          color: 0x000000,
          wireframe: true,
          opacity: 0.25,
          transparent: true,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = -1;
        return mesh;
      })();
      scene.add(planeMesh);

      const data = {
        amplitude: 0.1,
        amplitudeVariance: 0.3,
        speed: 1,
        speedVariance: 2,
      };

      const waves = [];
      const positions = planeMesh.geometry.getAttribute('position').array;
      const numPositions = positions.length / 3;
      for (let i = 0; i < numPositions; i++) {
        const v = new THREE.Vector3(
          positions[(i * 3) + 0],
          positions[(i * 3) + 1],
          positions[(i * 3) + 2]
        );
        waves.push({
          y: v.y,
          ang: Math.random() * Math.PI * 2,
          amp: data.amplitude + Math.random() * data.amplitudeVariance,
          speed: (data.speed + Math.random() * data.speedVariance) / 1000 // radians / frame
        });
      }

      const _update = () => {
        const worldTime = world.getWorldTime();

        const positionAttribute = planeMesh.geometry.getAttribute('position');
        const positions = positionAttribute.array;
        const numPositions = positions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          /* const v = new THREE.Vector3(
            positions[(i * 3] + 0],
            positions[(i * 3] + 1],
            positions[(i * 3] + 2]
          ); */
          const vprops = waves[i];
          // v.y = vprops.y + Math.sin(vprops.ang) * vprops.amp;
          const angValue = Math.sin(vprops.ang + (vprops.speed * worldTime));
          positions[(i * 3) + 1] = vprops.y + angValue * vprops.amp;
          // vprops.ang += vprops.speed;
        }
        positionAttribute.needsUpdate = true;
      };

      return {
        update: _update,
      };
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Ocean;
