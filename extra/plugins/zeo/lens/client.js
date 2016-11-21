const width = 0.1;
const height = 0.1;
const resolutionWidth = 128;
const resolutionHeight = 128;

const LENS_SHADER = {
  uniforms: {
    textureMap: {
      type: 't',
      value: null,
    }
  },
  vertexShader: [
    "varying vec4 texCoord;",
    "void main() {",
    "  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
    "  vec4 position = projectionMatrix * mvPosition;",
    "  texCoord = position;",
    "  texCoord.xy = 0.5*texCoord.xy + 0.5*texCoord.w;",
    "  gl_Position = position;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D textureMap;",
    "varying vec4 texCoord;",
    "void main() {",
    "  gl_FragColor = texture2DProj(textureMap, texCoord);",
    "}"
  ].join("\n")
};

class Lens {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = zeo;

        const renderTarget = new THREE.WebGLRenderTarget(resolutionWidth, resolutionHeight, {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          // format: THREE.RGBFormat,
          format: THREE.RGBAFormat,
        });

        const lensMesh = (() => {
          const object = new THREE.Object3D();
          object.position.y = 1.3;
          object.position.z = -0.1;

          const planeMesh = (() => {
            const geometry = new THREE.PlaneBufferGeometry(width, height, 1, 1);
            const material = (() => {
              const shaderUniforms = THREE.UniformsUtils.clone(LENS_SHADER.uniforms);
              const shaderMaterial = new THREE.ShaderMaterial({
                uniforms: shaderUniforms,
                vertexShader: LENS_SHADER.vertexShader,
                fragmentShader: LENS_SHADER.fragmentShader,
              })
              shaderMaterial.uniforms.textureMap.value = renderTarget.texture;
              shaderMaterial.polygonOffset = true;
              shaderMaterial.polygonOffsetFactor = -1;
              return shaderMaterial;
            })();

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          const lineMesh = (() => {
            const geometry = (() => {
              const result = new THREE.BufferGeometry();

              const positions = Float32Array.from([
                -width / 2, height / 2, 0,
                width / 2, height / 2, 0,
                width / 2, -height / 2, 0,
                -width / 2, -height / 2, 0,
                -width / 2, height / 2, 0, // loop back to start
              ]);
              result.addAttribute('position', new THREE.BufferAttribute(positions, 3));

              return result;
            })();
            const material = new THREE.LineBasicMaterial({
              color: 0x000000,
              // color: 0xFFFFFF,
              // linewidth: 5,
              // opacity: 0.25,
              // transparent: true,
            });

            const mesh = new THREE.Line(geometry, material);
            return mesh;
          })();
          object.add(lineMesh);
          object.lineMesh = lineMesh;

          return object;
        })();
        scene.add(lensMesh);

        this._cleanup = () => {
          scene.remove(lensMesh);
        };

        const _update = () => {
          const {planeMesh, lineMesh} = lensMesh;

          planeMesh.visible = false;
          lineMesh.visible = false;

          renderer.render(scene, camera, renderTarget);
          renderer.setRenderTarget(null);

          planeMesh.visible = true;
          lineMesh.visible = true;
        };

        return {
          update: _update,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Lens;
