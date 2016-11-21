const width = 0.1;
const height = 0.1;
const pixelWidth = 128;
const pixelHeight = 128;

const LENS_SHADER = {
  uniforms: {
    textureMap: {
      type: 't',
      value: null,
    },
    lightness: {
      type: 'f',
      value: 0,
    },
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
    "uniform float lightness;",
    "varying vec4 texCoord;",
    "void main() {",
    "  vec4 diffuse = texture2DProj(textureMap, texCoord);",
    "  gl_FragColor = vec4(mix(diffuse.rgb, vec3(1, 1, 1), lightness), diffuse.a);",
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

        const _makeRenderTarget = (width, height) => new THREE.WebGLRenderTarget(width, height, {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          // format: THREE.RGBFormat,
          format: THREE.RGBAFormat,
        });

        const planeGeometry = new THREE.PlaneBufferGeometry(width, height, 1, 1);

        const lineGeometry = (() => {
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
        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0x000000,
        });
        const _makeLineMesh = () => new THREE.Line(lineGeometry, lineMaterial);

        const blurLensMesh = (() => {
          const object = new THREE.Object3D();
          object.position.y = 1.4;
          object.position.z = -0.1;

          const width = window.innerWidth * window.devicePixelRatio / 4;
          const height = window.innerHeight * window.devicePixelRatio / 4;
          const renderTarget = _makeRenderTarget(width, height);
          const render = (() => {
            const horizontalBlurShader = {
              uniforms: (() => {
                const result = THREE.UniformsUtils.clone(THREE.HorizontalBlurShader.uniforms);
                result.h.value = 1 / width;
                return result;
              })(),
              vertexShader: THREE.HorizontalBlurShader.vertexShader,
              fragmentShader: THREE.HorizontalBlurShader.fragmentShader,
            };
            const verticalBlurShader = {
              uniforms: (() => {
                const result = THREE.UniformsUtils.clone(THREE.VerticalBlurShader.uniforms);
                result.v.value = 1 / height;
                return result;
              })(),
              vertexShader: THREE.VerticalBlurShader.vertexShader,
              fragmentShader: THREE.VerticalBlurShader.fragmentShader,
            };

            const composer = new THREE.EffectComposer(renderer, renderTarget);
            composer.addPass(new THREE.RenderPass(scene, camera));
            const hblur = new THREE.ShaderPass(horizontalBlurShader);
            composer.addPass(hblur);
            composer.addPass(hblur);
            const vblur = new THREE.ShaderPass(verticalBlurShader);
            composer.addPass(vblur);
            const vblurFinal = new THREE.ShaderPass(verticalBlurShader);
            vblurFinal.renderToScreen = true;

            composer.addPass(vblurFinal);

            return () => {
              composer.render();
              renderer.setRenderTarget(null);
            };
          })();
          object.render = render;

          const planeMesh = (() => {
            const geometry = planeGeometry;
            const material = (() => {
              const shaderUniforms = THREE.UniformsUtils.clone(LENS_SHADER.uniforms);
              shaderUniforms.lightness.value = 0.25;
              const shaderMaterial = new THREE.ShaderMaterial({
                uniforms: shaderUniforms,
                vertexShader: LENS_SHADER.vertexShader,
                fragmentShader: LENS_SHADER.fragmentShader,
              })
              shaderMaterial.uniforms.textureMap.value = renderTarget.texture;
              // shaderMaterial.polygonOffset = true;
              // shaderMaterial.polygonOffsetFactor = -1;
              return shaderMaterial;
            })();

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          const lineMesh = _makeLineMesh();
          object.add(lineMesh);
          object.lineMesh = lineMesh;

          return object;
        })();
        scene.add(blurLensMesh);

        const pixelLensMesh = (() => {
          const object = new THREE.Object3D();
          object.position.y = 1.2;
          object.position.z = -0.1;

          const renderTarget = _makeRenderTarget(pixelWidth, pixelHeight);
          object.render = () => {
            renderer.render(scene, camera, renderTarget);
            renderer.setRenderTarget(null);
          };

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
              // shaderMaterial.polygonOffset = true;
              // shaderMaterial.polygonOffsetFactor = -1;
              return shaderMaterial;
            })();

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          const lineMesh = _makeLineMesh();
          object.add(lineMesh);
          object.lineMesh = lineMesh;

          return object;
        })();
        scene.add(pixelLensMesh);

        const meshes = [ blurLensMesh, pixelLensMesh ];

        this._cleanup = () => {
          scene.remove(blurLensMesh);
          scene.remove(pixelLensMesh);
        };

        const _update = () => {
          meshes.forEach(mesh => {
            const {planeMesh, lineMesh} = mesh;

            planeMesh.visible = false;
            lineMesh.visible = false;
          });

          meshes.forEach(mesh => {
            mesh.render();
          });

          meshes.forEach(mesh => {
            const {planeMesh, lineMesh} = mesh;

            planeMesh.visible = true;
            lineMesh.visible = true;
          });
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
