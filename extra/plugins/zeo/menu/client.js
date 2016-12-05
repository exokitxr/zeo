const WIDTH = 2 * 1024;
const HEIGHT = WIDTH / 1.5;
const ASPECT_RATIO = WIDTH / HEIGHT;

const MENU_SIZE = 2;
const WORLD_WIDTH = MENU_SIZE;
const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;
const WORLD_DEPTH = MENU_SIZE / 50;

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
      const {THREE, scene, camera} = zeo;
      const transparentImg = biolumi.getTransparentImg();

      return biolumi.requestUi({
        width: WIDTH,
        height: HEIGHT,
      }).then(ui => {
        ui.pushPage({
          src: '<h1 style="font-size: 100px;">lol</h1><a onclick="lol"><p style="font-size: 32px;">Click here</p></a>',
        });

        const pages = ui.getPages();

        const solidMaterial = new THREE.MeshBasicMaterial({
          color: 0xFFFFFF,
          opacity: 0.5,
          transparent: true,
          // alphaTest: 0.5,
          depthWrite: false,
        });
        const wireframeMaterial = new THREE.MeshBasicMaterial({
          color: 0x0000FF,
          wireframe: true,
          opacity: 0.5,
          transparent: true,
        });
        const pointsMaterial = new THREE.PointsMaterial({
          color: 0x000000,
          size: 0.01,
        });

        const menuMesh = (() => {
          const result = new THREE.Object3D();
          result.position.y = 1.5;
          result.position.z = -1;

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
            const width = WORLD_WIDTH;
            const height = WORLD_HEIGHT;
            const depth = WORLD_DEPTH;

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

          return result;
        })();
        scene.add(menuMesh);

        const boxMesh = (() => {
          const geometry = new THREE.BoxBufferGeometry(1, 1, 1);

          const mesh = new THREE.Mesh(geometry, wireframeMaterial);
          mesh.visible = false;
          // mesh.renderOrder = -1;
          return mesh;
        })();
        scene.add(boxMesh);

        const dotMesh = (() => {
          const geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(Float32Array.from([0, 0, 0]), 3));

          const mesh = new THREE.Points(geometry, pointsMaterial);
          return mesh;
        })();
        scene.add(dotMesh);

        const _update = () => {
          const _updateMenuMesh = () => {
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
          const _updateAnchors = () => {
            const cameraPosition = new THREE.Vector3();
            const cameraRotation = new THREE.Quaternion();
            const cameraScale = new THREE.Vector3();
            camera.matrixWorld.decompose(cameraPosition, cameraRotation, cameraScale);

            const ray = new THREE.Vector3(0, 0, -1)
              .applyQuaternion(cameraRotation);
            const cameraLine = new THREE.Line3(
              cameraPosition.clone(),
              cameraPosition.clone().add(ray.clone().multiplyScalar(15))
            );

            const menuPosition = new THREE.Vector3();
            const menuRotation = new THREE.Quaternion();
            const menuScale = new THREE.Vector3();
            menuMesh.matrixWorld.decompose(menuPosition, menuRotation, menuScale);
            const menuNormalZ = new THREE.Vector3(0, 0, 1).applyQuaternion(menuRotation);

            const menuPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(menuNormalZ, menuPosition);
            const intersectionPoint = menuPlane.intersectLine(cameraLine);
            if (intersectionPoint) {
              const anchorBounds = (() => {
                const _getPlanePoint = (x, y, z) => menuPosition.clone()
                  .add(
                    new THREE.Vector3(
                      -WORLD_WIDTH / 2,
                      WORLD_HEIGHT / 2,
                      0
                    )
                    .add(
                      new THREE.Vector3(
                        (x / WIDTH) * WORLD_WIDTH,
                        (-y / HEIGHT) * WORLD_HEIGHT,
                        z
                      )
                    ).applyQuaternion(menuRotation)
                  );

                const result = [];
                for (let i = 0; i < pages.length; i++) {
                  const page = pages[i];
                  const {anchors} = page;

                  for (let j = 0; j < anchors.length; j++) {
                    const anchor = anchors[j];
                    const {rect} = anchor;

                    const anchorBound = new THREE.Box3().setFromPoints([
                      _getPlanePoint(rect.left, rect.top, -WORLD_DEPTH),
                      _getPlanePoint(rect.right, rect.bottom, WORLD_DEPTH)
                    ]);

                    result.push(anchorBound);
                  }
                }
                return result;
              })();
              const anchorBound = (() => {
                for (let i = 0; i < anchorBounds.length; i++) {
                  const anchorBound = anchorBounds[i];
                  if (anchorBound.containsPoint(intersectionPoint)) {
                    return anchorBound;
                  }
                }

                return null;
              })();

              // render
              dotMesh.position.copy(intersectionPoint);

              if (anchorBound) {
                boxMesh.position.copy(anchorBound.min.clone().add(anchorBound.max).divideScalar(2));
                boxMesh.scale.copy(anchorBound.max.clone().sub(anchorBound.min));

                if (!boxMesh.visible) {
                  boxMesh.visible = true;
                }
              } else {
                if (boxMesh.visible) {
                  boxMesh.visible = false;
                }
              }
            }
          };

          _updateMenuMesh();
          _updateAnchors();
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
