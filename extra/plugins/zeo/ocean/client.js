const OCEAN_SHADER = {
  uniforms: {
    worldTime: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: [
    "uniform float worldTime;",
    "attribute vec4 wave;",
    "void main() {",
    "  float y = wave[0];",
    "  float ang = wave[1];",
    "  float amp = wave[2];",
    "  float speed = wave[3];",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, y + ((sin(ang + (speed * worldTime))) * amp), position.z, 1.0);",
    "}"
  ].join("\n"),
  fragmentShader: [
    "void main() {",
    "  gl_FragColor = vec4(0.2, 0.2, 0.2, 0.25);",
    "}"
  ].join("\n")
};

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

        /* const material = new THREE.MeshBasicMaterial({
          color: 0x000000,
          wireframe: true,
          opacity: 0.25,
          transparent: true,
        }); */
        const uniforms = THREE.UniformsUtils.clone(OCEAN_SHADER.uniforms);
        const material = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: OCEAN_SHADER.vertexShader,
          fragmentShader: OCEAN_SHADER.fragmentShader,
          wireframe: true,
          // opacity: 0.25,
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

      const {geometry: planeMeshGeometry, material: planeMeshMaterial} = planeMesh;
      const wavesAttributeArray = (() => {
        const positions = planeMeshGeometry.getAttribute('position').array;
        const numPositions = positions.length / 3;

        const result = new Float32Array(numPositions * 4);
        for (let i = 0; i < numPositions; i++) {
          const y = positions[(i * 3) + 1];

          const baseIndex = i * 4;
          result[baseIndex + 0] = y; // y
          result[baseIndex + 1] = Math.random() * Math.PI * 2; // ang
          result[baseIndex + 2] = data.amplitude + Math.random() * data.amplitudeVariance; // amp
          result[baseIndex + 3] = (data.speed + Math.random() * data.speedVariance) / 1000; // speed
        }
        return result;
      })();
      planeMeshGeometry.addAttribute('wave', new THREE.BufferAttribute(wavesAttributeArray, 4));

      const _update = () => {
        const worldTime = world.getWorldTime();
        planeMeshMaterial.uniforms.worldTime.value = worldTime;
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
