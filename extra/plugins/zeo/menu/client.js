const WIDTH = 2 * 1024;
const HEIGHT = WIDTH / 1.5;
const ASPECT_RATIO = WIDTH / HEIGHT;

const MENU_SIZE = 2;

const MAX_NUM_TEXTURES = 3;

const IMAGE_SHADER = {
  uniforms: {
    textures: {
      type: 'tv',
      value: null,
    },
    validTextures: {
      type: 'iv1',
      value: null,
    },
    textureUvs: {
      type: 'v2v',
      value: null,
    },
  },
  vertexShader: [
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = uv;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D textures[" + MAX_NUM_TEXTURES + "];",
    "uniform int validTextures[" + MAX_NUM_TEXTURES + "];",
    "uniform vec2 textureUvs[" + MAX_NUM_TEXTURES + "];",
    "varying vec2 vUv;",
    "void main() {",
    "  vec4 diffuse = vec4(0, 0, 0, 0);",
    "  int numValidTextures = 0;",
    "  for (int i = 0; i < " + MAX_NUM_TEXTURES + "; i++) {",
    "    if (validTextures[i] != 0) {",
    "      diffuse += texture2D(textures[i], vUv + textureUvs[i]);",
    "      numValidTextures++;",
    "    }",
    "  }",
    "  diffuse /= float(numValidTextures);",
    "  gl_FragColor = diffuse;",
    "}"
  ].join("\n")
};

class Menu {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    this._cleanup = () => {};

    return archae.requestEngines([
      '/core/engines/zeo',
      '/core/engines/biolumi',
    ]).then(([
      zeo,
      biolumi,
    ]) => {
      const {THREE, scene} = zeo;
      const transparentImg = biolumi.getTransparentImg();

      return biolumi.requestUi({
        width: WIDTH,
        height: HEIGHT,
      }).then(ui => {
        ui.pushPage({
          src: '<h1>lol</h1><a onclick="lol">Click here</a>',
        });

        const pages = ui.getPages();

        const menuMesh = (() => {
          const result = new THREE.Object3D();
          result.position.y = 1.5;
          result.position.z = -1;

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });
          const solidMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            opacity: 0.5,
            transparent: true,
            // alphaTest: 0.5,
            depthWrite: false,
          });

          const imageMaterial = (() => {
            const shaderUniforms = THREE.UniformsUtils.clone(IMAGE_SHADER.uniforms);
            shaderUniforms.textures.value = (() => {
              const result = Array(MAX_NUM_TEXTURES);
              for (let i = 0; i < MAX_NUM_TEXTURES; i++) {
                const texture = new THREE.Texture(
                  transparentImg,
                  THREE.UVMapping,
                  THREE.ClampToEdgeWrapping,
                  THREE.ClampToEdgeWrapping,
                  THREE.LinearFilter,
                  THREE.LinearFilter,
                  THREE.RGBAFormat,
                  THREE.UnsignedByteType,
                  16
                );
                // texture.needsUpdate = true;

                result[i] = texture;
              }
              return result;
            })();
            shaderUniforms.validTextures.value = (() => {
              const result = Array(MAX_NUM_TEXTURES);
              for (let i = 0; i < MAX_NUM_TEXTURES; i++) {
                result[i] = 0;
              }
              return result;
            })();
            shaderUniforms.textureUvs.value = (() => {
              const result = Array(2 * MAX_NUM_TEXTURES);
              for (let i = 0; i < MAX_NUM_TEXTURES; i++) {
                result[(i * 2) + 0] = 0;
                result[(i * 2) + 1] = 0;
              }
              return result;
            })();
            const shaderMaterial = new THREE.ShaderMaterial({
              uniforms: shaderUniforms,
              vertexShader: IMAGE_SHADER.vertexShader,
              fragmentShader: IMAGE_SHADER.fragmentShader,
              transparent: true,
            });
            return shaderMaterial;
          })();

          const planeMesh = (() => {
            const width = MENU_SIZE;
            const height = MENU_SIZE / ASPECT_RATIO;
            const depth = MENU_SIZE / 20;

            const geometry = new THREE.PlaneBufferGeometry(width, height, depth);
            const textureUvsArray = (() => {
              const numPositions = 8;
              const numTextures = MAX_NUM_TEXTURES;
              const result = new Float32Array(numPositions);
              for (let i = 0; i < numPositions; i++) {
                for (let j = 0; j < numTextures; j++) {
                  const baseIndex = (i * numTextures * 2) + (j * 2);
                  result[baseIndex + 0] = 0;
                  result[baseIndex + 1] = 0;
                }
              }
              return result;
            })();
            geometry.addAttribute('textureUvs', new THREE.BufferAttribute(textureUvsArray, 2 * MAX_NUM_TEXTURES));

            const materials = [solidMaterial, imageMaterial];

            const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
            mesh.imageMaterial = imageMaterial;
            return mesh;
          })();
          result.add(planeMesh);
          result.planeMesh = planeMesh;

          /* const boxMesh = (() => {
            const width = menuSize;
            const height = menuSize / menuItems.length;
            const depth = menuSize / 10;
            const geometry = new THREE.BoxBufferGeometry(width, height, depth);
            geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, (menuSize / 2) - (height / 2), 0));

            const mesh = new THREE.Mesh(geometry, wireframeMaterial);
            mesh.visible = false;
            mesh.renderOrder = -1;
            return mesh;
          })();
          result.add(boxMesh);
          result.boxMesh = boxMesh; */

          return result;
        })();
        scene.add(menuMesh);

        const _update = () => {
          const {planeMesh: {imageMaterial}} = menuMesh;
          const {uniforms: {texture, textures, validTextures, textureUvs}} = imageMaterial;

          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];

            if (textures.value[i].image !== page.img) {
              textures.value[i].image = page.img;
              textures.value[i].needsUpdate = true;
            }

            validTextures.value[i] = page.valid ? 1 : 0;

            textureUvs.value[(i * 2) + 0] = page.x;
            textureUvs.value[(i * 2) + 1] = page.y;
          }
        };

        return {
          update: _update,
        };
      });
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Menu;
