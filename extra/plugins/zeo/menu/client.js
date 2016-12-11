const WIDTH = 2 * 1024;
const HEIGHT = WIDTH / 1.5;
const ASPECT_RATIO = WIDTH / HEIGHT;

const MENU_SIZE = 2;
const WORLD_WIDTH = MENU_SIZE;
const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;
const WORLD_DEPTH = MENU_SIZE / 50;

class Menu {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return Promise.all([
      archae.requestEngines([
        '/core/engines/zeo',
        '/core/engines/biolumi',
      ]),
      archae.requestPlugins([
        '/core/plugins/creature-utils',
      ]),
    ]).then(([
      [zeo, biolumi],
      [creatureUtils],
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;
        const world = zeo.getCurrentWorld();
        const fonts = biolumi.getFonts();
        const fontWeight = biolumi.getFontWeight();
        const transparentImg = biolumi.getTransparentImg();
        const maxNumTextures = biolumi.getMaxNumTextures();

        const fontSize = 72;
        const inputText = 'Hello, world! This is some text!';
        let inputValue = 0.4;
        let sliderValue = 0.5;
        const getPageSrc = ({inputValue, sliderValue}) => `\
<h1 style='font-size: 100px;'>lol</h1>
<a onclick="next"><p style="font-size: 32px;">Click here</p></a>
<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 200px;">
  <div style='position: relative; height: 100px; font-size: ${fontSize}px; line-height: 1.4;' onclick="input">
    <a style='display: block; position: absolute; top: 0; bottom: 0; left: 40px; right: 40px; background-color: #FFF;' onclick="input">
      <div style="position: absolute; top: 0; bottom: 20px; left: 0; right: 0; border-bottom: 5px solid #333; box-sizing: border-box;"></div>
      <div style="position: absolute; top: 0; bottom: 20px; left: ${inputValue * (WIDTH - (40 + 40))}px; margin-left: -1px; width: 2px; background-color: #333;"></div>
      <div>${inputText}</div>
    </a>
  </div>
  <div style="position: relative; height: 100px;" onclick="input">
    <a style="display: block; position: absolute; top: 0; bottom: 0; left: 40px; right: 40px;" onclick="resolution">
      <div style="position: absolute; top: 40px; left: 0; right: 0; height: 10px; background-color: #CCC;">
        <div style="position: absolute; top: -40px; bottom: -40px; left: ${sliderValue * WIDTH}px; margin-left: -5px; width: 10px; background-color: #F00;"></div>
      </div>
    </a>
  </div>
</div>
`;
        const imageShader = {
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
            textureDimensions: {
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
            "uniform sampler2D textures[" + maxNumTextures + "];",
            "uniform int validTextures[" + maxNumTextures + "];",
            "uniform vec2 textureUvs[" + maxNumTextures + "];",
            "uniform vec2 textureDimensions[" + maxNumTextures + "];",
            "varying vec2 vUv;",
            "void main() {",
            "  vec3 diffuse = vec3(0.0, 0.0, 0.0);",
            "  float alpha = 0.0;",
            "  int numDiffuse = 0;",
            "  int numAlpha = 0;",
            "  for (int i = 0; i < " + maxNumTextures + "; i++) {",
            "    if (validTextures[i] != 0) {",
            "      vec2 uv = vec2(",
            "        (vUv.x - textureUvs[i].x) / textureDimensions[i].x,",
            "        1.0 - (((1.0 - vUv.y) - textureUvs[i].y) / textureDimensions[i].y)",
            "      );",
            "      if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {",
            "        vec4 sample = texture2D(textures[i], uv);",
            "        diffuse += sample.xyz;",
            "        numDiffuse++;",
            "",
            "        if (sample.w > 0.0) {",
            "          alpha += sample.w;",
            "          numAlpha++;",
            "        }",
            "      }",
            "    }",
            "  }",
            "  gl_FragColor = vec4(diffuse / float(numDiffuse), alpha / float(numAlpha));",
            "}"
          ].join("\n")
        };

        return biolumi.requestUi({
          width: WIDTH,
          height: HEIGHT,
        }).then(ui => {
          if (live) {
            const measureText = (() => {
              const div = document.createElement('div');
              div.style.cssText = `\
position: absolute;
top: 0;
left: 0;
font-family: ${fonts};
font-size: ${fontSize};
font-weight: 300;
line-height: 1.4;
white-space: pre;
visibility: hidden;
`;
window.div = div;
              document.body.appendChild(div);

              const result = text => {
                div.innerText = text;
                const width = div.offsetWidth;
                div.innerText = '';
                return width;
              };
              result.destroy = () => {
                document.body.removeChild(div);
              };
              return result;
            })();

            ui.pushPage([
              {
                type: 'html',
                src: getPageSrc({inputValue, sliderValue}),
              },
              {
                type: 'image',
                img: creatureUtils.makeCreature(),
                x: 200,
                y: 0,
                w: 300,
                h: 300,
                frameTime: 300,
              }
            ]);

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
              result.position.z = -0.5;

              const imageMaterial = (() => {
                const shaderUniforms = THREE.UniformsUtils.clone(imageShader.uniforms);
                shaderUniforms.textures.value = (() => {
                  const result = Array(maxNumTextures);
                  for (let i = 0; i < maxNumTextures; i++) {
                    const texture = new THREE.Texture(
                      transparentImg,
                      THREE.UVMapping,
                      THREE.ClampToEdgeWrapping,
                      THREE.ClampToEdgeWrapping,
                      THREE.NearestFilter,
                      THREE.NearestFilter,
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
                  const result = Array(maxNumTextures);
                  for (let i = 0; i < maxNumTextures; i++) {
                    result[i] = 0;
                  }
                  return result;
                })();
                shaderUniforms.textureUvs.value = (() => {
                  const result = Array(2 * maxNumTextures);
                  for (let i = 0; i < maxNumTextures; i++) {
                    result[(i * 2) + 0] = 0;
                    result[(i * 2) + 1] = 0;
                  }
                  return result;
                })();
                shaderUniforms.textureDimensions.value = (() => {
                  const result = Array(2 * maxNumTextures);
                  for (let i = 0; i < maxNumTextures; i++) {
                    result[(i * 2) + 0] = 0;
                    result[(i * 2) + 1] = 0;
                  }
                  return result;
                })();
                const shaderMaterial = new THREE.ShaderMaterial({
                  uniforms: shaderUniforms,
                  vertexShader: imageShader.vertexShader,
                  fragmentShader: imageShader.fragmentShader,
                  transparent: true,
                });
                // shaderMaterial.polygonOffset = true;
                // shaderMaterial.polygonOffsetFactor = 1;
                return shaderMaterial;
              })();

              const planeMesh = (() => {
                const width = WORLD_WIDTH;
                const height = WORLD_HEIGHT;
                const depth = WORLD_DEPTH;

                const geometry = new THREE.PlaneBufferGeometry(width, height, depth);
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
              mesh.anchor = null;
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

            const click = () => {
              const {anchor} = boxMesh;

              if (anchor) {
                const {onclick} = anchor;

                if (onclick) {
                  if (onclick === 'next') {
                    ui.cancelTransition();

                    if (ui.getPages().length < 3) {
                      ui.pushPage([
                        {
                          type: 'html',
                          src: getPageSrc({inputValue, sliderValue}),
                        },
                        {
                          type: 'image',
                          img: creatureUtils.makeCreature(),
                          x: 200,
                          y: 0,
                          w: 300,
                          h: 300,
                          frameTime: 300,
                        }
                      ]);
                    } else {
                      ui.popPage();
                    }
                  } else if (onclick === 'input') {
                    const {value} = boxMesh;
                    const valuePx = value * (WIDTH - (40 + 40));

                    const slices = (() => {
                      const result = [];
                      for (let i = 0; i <= inputText.length; i++) {
                        const slice = inputText.slice(0, i);
                        result.push(slice);
                      }
                      return result;
                    })();
                    const widths = slices.map(slice => measureText(slice));
                    const distances = widths.map(width => Math.abs(valuePx - width));
                    const sortedDistances = distances
                      .map((distance, index) => ([distance, index]))
                      .sort(([aDistance], [bDistance]) => (aDistance - bDistance));
                    const index = sortedDistances[0][1];
                    const closestValuePx = widths[index];
                    // const slice = slices[index];

                    inputValue = closestValuePx / (WIDTH - (40 + 40));

                    ui.replacePage([
                      {
                        type: 'html',
                        src: getPageSrc({inputValue, sliderValue}),
                      },
                    ]);
                  } else if (onclick === 'resolution') {
                    const {value} = boxMesh;

                    console.log('set resolution', value);
                  }
                }
              }
            };
            window.addEventListener('click', click);

            this._cleanup = () => {
              measureText.destroy();

              scene.remove(menuMesh);
              scene.remove(boxMesh);
              scene.remove(dotMesh);

              window.removeEventListener('click', click);
            };

            const _update = () => {
              const _updateMenuMesh = () => {
                const {planeMesh: {imageMaterial}} = menuMesh;
                const {uniforms: {texture, textures, validTextures, textureUvs, textureDimensions}} = imageMaterial;

                const layers = ui.getLayers();
                const worldTime = world.getWorldTime();
                for (let i = 0; i < layers.length; i++) {
                  const layer = layers[i];

                  if (layer.getValid({worldTime})) {
                    validTextures.value[i] = 1;

                    if (textures.value[i].image !== layer.img) {
                      textures.value[i].image = layer.img;
                      textures.value[i].needsUpdate = true;
                    }

                    const position = layer.getPosition();
                    textureUvs.value[(i * 2) + 0] = position.x;
                    textureUvs.value[(i * 2) + 1] = position.y;
                    textureDimensions.value[(i * 2) + 0] = position.w;
                    textureDimensions.value[(i * 2) + 1] = position.h;
                  } else {
                    validTextures.value[i] = 0;
                  }
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

                  const anchorBoxes = (() => {
                    const result = [];
                    const layers = ui.getLayers();
                    for (let i = 0; i < layers.length; i++) {
                      const layer = layers[i];
                      const anchors = layer.getAnchors();

                      for (let j = 0; j < anchors.length; j++) {
                        const anchor = anchors[j];
                        const {rect} = anchor;

                        const anchorBox = new THREE.Box3().setFromPoints([
                          _getPlanePoint(rect.left, rect.top, -WORLD_DEPTH),
                          _getPlanePoint(rect.right, rect.bottom, WORLD_DEPTH),
                        ]);
                        anchorBox.anchor = anchor;

                        result.push(anchorBox);
                      }
                    }
                    return result;
                  })();
                  const anchorBox = (() => {
                    for (let i = 0; i < anchorBoxes.length; i++) {
                      const anchorBox = anchorBoxes[i];
                      if (anchorBox.containsPoint(intersectionPoint)) {
                        return anchorBox;
                      }
                    }

                    return null;
                  })();

                  // render
                  dotMesh.position.copy(intersectionPoint);

                  if (anchorBox) {
                    boxMesh.position.copy(anchorBox.min.clone().add(anchorBox.max).divideScalar(2));
                    boxMesh.scale.copy(anchorBox.max.clone().sub(anchorBox.min));

                    const {anchor} = anchorBox;
                    boxMesh.anchor = anchor;
                    boxMesh.value = (() => {
                      const {rect} = anchor;
                      const horizontalLine = new THREE.Line3(
                        _getPlanePoint(rect.left, (rect.top + rect.bottom) / 2, 0),
                        _getPlanePoint(rect.right, (rect.top + rect.bottom) / 2, 0)
                      );
                      const closestHorizontalPoint = horizontalLine.closestPointToPoint(intersectionPoint, true);
                      return new THREE.Line3(horizontalLine.start.clone(), closestHorizontalPoint.clone()).distance() / horizontalLine.distance();
                    })();

                    if (!boxMesh.visible) {
                      boxMesh.visible = true;
                    }
                  } else {
                    boxMesh.anchor = null;

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
          }
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Menu;
