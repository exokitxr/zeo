const EffectComposer = require('./lib/three-extra/postprocessing/EffectComposer');
const HorizontalBlurShader = require('./lib/three-extra/shaders/HorizontalBlurShader');
const VerticalBlurShader = require('./lib/three-extra/shaders/VerticalBlurShader');

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
  mount() {
    const {three: {THREE, scene, camera, renderer}, elements, render} = zeo;

    const THREEEffectComposer = EffectComposer(THREE);
    const {THREERenderPass, THREEShaderPass} = THREEEffectComposer;
    const THREEHorizontalBlurShader = HorizontalBlurShader(THREE);
    const THREEVerticalBlurShader = VerticalBlurShader(THREE);

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
    });

    class LensElement extends HTMLElement {
      createdCallback() {
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
        const _makeLineMesh = () => new THREE.Line(lineGeometry, lineMaterial);

        const _makeBlurLensMesh = () => {
          const object = new THREE.Object3D();
          object.position.set(0, 1.4 - (0 * 0.2), -0.1);

          const width = window.innerWidth * window.devicePixelRatio / 4;
          const height = window.innerHeight * window.devicePixelRatio / 4;
          const renderTarget = _makeRenderTarget(width, height);
          const render = (() => {
            const horizontalBlurShader = {
              uniforms: (() => {
                const result = THREE.UniformsUtils.clone(THREEHorizontalBlurShader.uniforms);
                result.h.value = 1 / width;
                return result;
              })(),
              vertexShader: THREEHorizontalBlurShader.vertexShader,
              fragmentShader: THREEHorizontalBlurShader.fragmentShader,
            };
            const verticalBlurShader = {
              uniforms: (() => {
                const result = THREE.UniformsUtils.clone(THREEVerticalBlurShader.uniforms);
                result.v.value = 1 / height;
                return result;
              })(),
              vertexShader: THREEVerticalBlurShader.vertexShader,
              fragmentShader: THREEVerticalBlurShader.fragmentShader,
            };

            const composer = new THREEEffectComposer(renderer, renderTarget);
            const renderPass = new THREERenderPass(scene, camera);
            composer.addPass(renderPass);
            const hblur = new THREEShaderPass(horizontalBlurShader);
            composer.addPass(hblur);
            composer.addPass(hblur);
            const vblur = new THREEShaderPass(verticalBlurShader);
            composer.addPass(vblur);
            const vblurFinal = new THREEShaderPass(verticalBlurShader);
            // vblurFinal.renderToScreen = true;

            composer.addPass(vblurFinal);

            return (scene, camera) => {
              renderPass.scene = scene;
              renderPass.camera = camera;

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
        };
        const _makePixelLensMesh = () => {
          const object = new THREE.Object3D();
          object.position.set(0, 1.4 - (1 * 0.2), -0.1);

          const renderTarget = _makeRenderTarget(pixelWidth, pixelHeight);
          object.render = (scene, camera) => {
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
        };
        const meshConstructors = {
          blur: _makeBlurLensMesh,
          pixel: _makePixelLensMesh,
        };
        this.meshConstructors = meshConstructors;

        const mesh = _makeBlurLensMesh();
        scene.add(mesh);
        this.mesh = mesh;

        const updateEye = eyeCamera => {
          const {mesh} = this;
          const {planeMesh, lineMesh} = mesh;
          planeMesh.visible = false;
          lineMesh.visible = false;

          mesh.render(scene, eyeCamera);

          planeMesh.visible = true;
          lineMesh.visible = true;
        };
        updateEyes.push(updateEye);

        this._cleanup = () => {
          const {mesh} = this;

          scene.remove(mesh);

          updateEyes.splice(updateEyes.indexOf(updateEye), 1);
        };
      }

      destructor() {
        this._cleanup();
      }

      attributeValueChangedCallback(name, oldValue, newValue) {
        switch (name) {
          case 'position': {
            const {mesh} = this;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            mesh.scale.set(newValue[7], newValue[8], newValue[9]);

            break;
          }
          case 'type': {
            const {mesh: oldMesh, meshConstructors} = this;
            scene.remove(oldMesh);

            const meshConstructor = meshConstructors[newValue];
            const newMesh = meshConstructor();
            scene.add(newMesh);
            this.mesh = newMesh;

            break;
          }
        }
      }
    }
    elements.registerElement(this, LensElement);

    const updateEyes = [];
    const _updateEye = camera => {
      for (let i = 0; i < updateEyes.length; i++) {
        const updateEye = updateEyes[i];
        updateEye(camera);
      }
    };
    render.on('updateEye', _updateEye);

    this._cleanup = () => {
      elements.unregisterElement(this);

      render.removeListener('updateEye', _updateEye);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Lens;
