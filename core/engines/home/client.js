import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  TAGS_WIDTH,
  TAGS_HEIGHT,
  TAGS_ASPECT_RATIO,
  TAGS_WORLD_WIDTH,
  TAGS_WORLD_HEIGHT,
  TAGS_WORLD_DEPTH,

  SERVER_WIDTH,
  SERVER_HEIGHT,
  SERVER_WORLD_WIDTH,
  SERVER_WORLD_HEIGHT,

  WALKTHROUGH_WIDTH,
  WALKTHROUGH_HEIGHT,
  WALKTHROUGH_WORLD_WIDTH,
  WALKTHROUGH_WORLD_HEIGHT,

  SPHERE_RADIUS,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/menu';
import menuRender from './lib/render/menu';

const VIDEOS = [
  {
    name: 'Introduction 1: Controls',
    video: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.webm',
    thumbnail: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.png',
  },
  {
    name: 'Introduction 2: Modules',
    video: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample2.webm',
    thumbnail: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample2.png',
  },
  {
    name: 'Introduction 3: Multiplayer',
    video: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.webm',
    thumbnail: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.png',
  },
  {
    name: 'Introduction 4: Host your own',
    video: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample2.webm',
    thumbnail: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample2.png',
  },
  {
    name: 'Introduction 5: Host your own',
    video: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.webm',
    thumbnail: 'https://raw.githubusercontent.com/modulesio/zeo-data/c6e33eedbbd7cabe3b3d18a8e7219048114ee722/video/sample1.png',
  },
];

const SIDES = ['left', 'right'];

class Home {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {home: {enabled: homeEnabled}, my: {enabled: myEnabled}, hub: {url: hubUrl}}} = archae;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    if (homeEnabled) {
      const _requestBlobBase64 = blob => new Promise((accept, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          accept(reader.result);
        };
        reader.onerror = err => {
          reject(err);
        };
      });
      const _requestVideoSpecs = () => Promise.all(VIDEOS.map(videoSpec =>
        fetch(videoSpec.thumbnail)
          .then(res => res.blob()
            .then(blob => _requestBlobBase64(blob))
            .then(thumbnailImgData => {
              const {name, video, thumbnail} = videoSpec;

              return {
                name,
                video,
                thumbnail,
                thumbnailImgData,
              };
            })
          )
      ));
      const _requestDefaultTags = () => fetch('/archae/home/defaults/data/world/tags.json')
        .then(res => res.json()
          .then(({tags}) => Object.keys(tags).map(id => tags[id]))
        );

      return Promise.all([
        archae.requestPlugins([
          '/core/engines/bootstrap',
          '/core/engines/input',
          '/core/engines/three',
          '/core/engines/webvr',
          '/core/engines/biolumi',
          '/core/engines/cyborg',
          '/core/engines/somnifer',
          '/core/engines/rend',
          '/core/engines/keyboard',
          '/core/engines/tags',
          '/core/utils/js-utils',
          '/core/utils/geometry-utils',
          '/core/utils/creature-utils',
        ]),
        _requestVideoSpecs(),
        _requestDefaultTags(),
      ])
        .then(([
          [
            bootstrap,
            input,
            three,
            webvr,
            biolumi,
            cyborg,
            somnifer,
            rend,
            keyboard,
            tags,
            jsUtils,
            geometryUtils,
            creatureUtils,
          ],
          videos,
        ]) => {
          if (live) {
            const {THREE, scene, camera, renderer} = three;
            const {events} = jsUtils;
            const {EventEmitter} = events;

            const menuRenderer = menuRender.makeRenderer({
              creatureUtils,
            });

            const transparentMaterial = biolumi.getTransparentMaterial();
            const transparentImg = biolumi.getTransparentImg();

            const _decomposeObjectMatrixWorld = object => {
              const position = new THREE.Vector3();
              const rotation = new THREE.Quaternion();
              const scale = new THREE.Vector3();
              object.matrixWorld.decompose(position, rotation, scale);
              return {position, rotation, scale};
            };

            const wireframeHighlightMaterial = new THREE.MeshBasicMaterial({
              color: 0x0000FF,
              wireframe: true,
              opacity: 0.5,
              transparent: true,
            });
            const _makeSolidMaterial = color => new THREE.MeshPhongMaterial({
              color: color,
              // shininess: 0,
              shading: THREE.FlatShading,
            });
            const solidMaterials = {
              red: _makeSolidMaterial(0xF44336),
              white: _makeSolidMaterial(0xFFFFFF),
              blue: _makeSolidMaterial(0x2196F3),
              green: _makeSolidMaterial(0x4CAF50),
            };
            const _makeTransparentMaterial = color => new THREE.MeshPhongMaterial({
              color: color,
              // shininess: 0,
              shading: THREE.FlatShading,
              transparent: true,
              opacity: 0.5,
            });
            const transparentMaterials = {
              red: _makeTransparentMaterial(0xF44336),
            };

            const controllerMeshOffset = new THREE.Vector3(0, 0, -0.02);
            const controllerMeshQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
            const oneVector = new THREE.Vector3(1, 1, 1);
            const backVector = new THREE.Vector3(0, 0, 1);
            const sphereDiameterVector = new THREE.Vector3(SPHERE_RADIUS * 2, SPHERE_RADIUS * 2, SPHERE_RADIUS * 2);

            const mainFontSpec = {
              fonts: biolumi.getFonts(),
              fontSize: 40,
              lineHeight: 1.4,
              fontWeight: biolumi.getFontWeight(),
              fontStyle: biolumi.getFontStyle(),
            };
            const homeState = {
              page: '',
              username: '',
              inputText: '',
              loading: false,
              vrMode: bootstrap.getVrMode(),
            };
            const mediaState = {
              paused: true,
              value: 0,
            };
            const focusState = {
              keyboardFocusState: null,
            };
            const _makeTargetState = () => ({
              pointed: false,
            });
            const targetStates = {
              left: _makeTargetState(),
              right: _makeTargetState(),
            };

            /* const _vrModeChange = vrMode => { // XXX we might not need this with the
              homeState.vrMode = vrMode;

              _updatePages();
            };
            bootstrap.on('vrModeChange', _vrModeChange); */

            const tutorialMesh = (() => {
              const object = new THREE.Object3D();
              object.visible = bootstrap.getTutorialFlag();

              const planeMesh = (() => {
                const menuUi = biolumi.makeUi({
                  width: WIDTH,
                  height: HEIGHT,
                });
                const mesh = menuUi.makePage(({
                  home: {
                    page,
                    inputText,
                    loading,
                    vrMode,
                  },
                  videos,
                  focus: {
                    keyboardFocusState,
                  },
                }) => {
                  const {type: focusType = '', inputIndex = 0, inputValue = 0} = keyboardFocusState || {};

                  return {
                    type: 'html',
                    src: menuRenderer.getHomeMenuSrc({
                      page,
                      inputText,
                      inputIndex,
                      inputValue,
                      loading,
                      vrMode,
                      focusType,
                      videos,
                    }),
                    x: 0,
                    y: 0,
                    w: WIDTH,
                    h: HEIGHT,
                  };
                }, {
                  type: 'home',
                  state: {
                    home: homeState,
                    videos: videos,
                    focus: focusState,
                  },
                  worldWidth: WORLD_WIDTH,
                  worldHeight: WORLD_HEIGHT,
                });
                mesh.receiveShadow = true;

                const {page} = mesh;
                rend.addPage(page);

                cleanups.push(() => {
                  rend.removePage(page);
                });

                return mesh;
              })();
              object.add(planeMesh);
              object.planeMesh = planeMesh;

              const videoMesh = (() => {
                const object = new THREE.Object3D();
                object.visible = false;

                const viewportMesh = (() => {
                  const worldWidth = WORLD_WIDTH;
                  const worldHeight = WORLD_HEIGHT * ((HEIGHT - 300) / HEIGHT);
                  const geometry = new THREE.PlaneBufferGeometry(worldWidth, worldHeight);
                  const texture = new THREE.Texture(
                    transparentImg,
                    THREE.UVMapping,
                    THREE.ClampToEdgeWrapping,
                    THREE.ClampToEdgeWrapping,
                    THREE.NearestFilter,
                    THREE.NearestFilter,
                    THREE.RGBFormat,
                    THREE.UnsignedByteType,
                    16
                  );
                  texture.needsUpdate = true;
                  const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide,
                  });

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.position.y = (WORLD_HEIGHT / 2) - (worldHeight / 2) - (WORLD_HEIGHT * (100 / HEIGHT));
                  mesh.position.z = 0.001;

                  return mesh;
                })();
                object.add(viewportMesh);
                object.viewportMesh = viewportMesh;

                const controlsMesh = (() => { // XXX break this up into two meshes for performance
                  const worldWidth = WORLD_WIDTH;
                  const worldHeight = WORLD_HEIGHT * ((HEIGHT - 200) / HEIGHT);
                  const menuUi = biolumi.makeUi({
                    width: WIDTH,
                    height: HEIGHT - 200,
                    color: [1, 1, 1, 0],
                  });
                  const mesh = menuUi.makePage(({
                    media: {
                      paused,
                      value,
                    },
                  }) => ({
                    type: 'html',
                    src: menuRenderer.getMediaControlsSrc({
                      paused,
                      value,
                    }),
                    x: 0,
                    y: 0,
                    w: WIDTH,
                    h: HEIGHT - 200,
                  }), {
                    type: 'videoControls',
                    state: {
                      media: mediaState,
                    },
                    worldWidth: worldWidth,
                    worldHeight: worldHeight,
                  });
                  mesh.position.y = (WORLD_HEIGHT / 2) - (worldHeight / 2) - (WORLD_HEIGHT * (100 / HEIGHT));
                  mesh.position.z = 0.002;

                  const {page} = mesh;
                  rend.addPage(page);
                  page.update();

                  cleanups.push(() => {
                    rend.removePage(page);
                  });

                  return mesh;
                })();
                object.add(controlsMesh);
                object.controlsMesh = controlsMesh;

                const soundBody = somnifer.makeBody();
                soundBody.setObject(object);
                object.soundBody = soundBody;

                return object;
              })();
              object.add(videoMesh);
              object.videoMesh = videoMesh;

              const shadowMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
                const material = transparentMaterial.clone();
                material.depthWrite = false;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                return mesh;
              })();
              object.add(shadowMesh);

              return object;
            })();
            rend.registerMenuMesh('tutorialMesh', tutorialMesh);

            const walkthroughMeshes = (() => {
              const result = {};

              const _makeWalkthroughMesh = label => {
                const menuUi = biolumi.makeUi({
                  width: WALKTHROUGH_WIDTH,
                  height: WALKTHROUGH_HEIGHT,
                  color: [0, 0, 0, 0],
                });
                const mesh = menuUi.makePage(({
                  // nothing
                }) => {
                  return {
                    type: 'html',
                    src: menuRenderer.getWalkthroughSrc({
                      label: label,
                    }),
                    x: 0,
                    y: 0,
                    w: WALKTHROUGH_WIDTH,
                    h: WALKTHROUGH_HEIGHT,
                  };
                }, {
                  type: 'home',
                  state: {},
                  worldWidth: WALKTHROUGH_WORLD_WIDTH,
                  worldHeight: WALKTHROUGH_WORLD_HEIGHT,
                });
                mesh.visible = false;

                const {page} = mesh;
                page.update();

                return mesh;
              };

              const hmd = cyborg.getHmd();
              const {hudMesh} = hmd;
              const controllers = cyborg.getControllers();
              const controllerMeshes = {
                left: controllers.left.mesh,
                right: controllers.right.mesh,
              };

              const _makeControllerWalkthroughMesh = side => {
                const walkthroughMesh = _makeWalkthroughMesh(side === 'left' ? 'Z' : 'C');
                walkthroughMesh.position.y = 0.1;

                const controllerMesh = controllerMeshes[side];
                controllerMesh.add(walkthroughMesh);

                return walkthroughMesh;
              };
              const controllerLabelMeshes = {
                left: _makeControllerWalkthroughMesh('left'),
                right: _makeControllerWalkthroughMesh('right'),
              };
              result.controllerLabelMeshes = controllerLabelMeshes;

              const clickLabelMesh = (() => {
                const walkthroughMesh = _makeWalkthroughMesh('Click');
                walkthroughMesh.position.y = 0.1;

                const {left: leftControllerMesh} = controllerMeshes;
                leftControllerMesh.add(walkthroughMesh);
                return walkthroughMesh;
              })();
              result.clickLabelMesh = clickLabelMesh;

              const menuButtonMesh1 = (() => {
                const walkthroughMesh = _makeWalkthroughMesh('E');
                walkthroughMesh.position.y = 0.1;

                const {left: leftControllerMesh} = controllerMeshes;
                leftControllerMesh.add(walkthroughMesh);
                return walkthroughMesh;
              })();
              result.menuButtonMesh1 = menuButtonMesh1;

              const menuButtonMesh2 = (() => {
                const walkthroughMesh = _makeWalkthroughMesh('E (again)');
                walkthroughMesh.position.y = 0.1;

                const {left: leftControllerMesh} = controllerMeshes;
                leftControllerMesh.add(walkthroughMesh);
                return walkthroughMesh;
              })();
              result.menuButtonMesh2 = menuButtonMesh2;

              const padButtonMesh = (() => {
                const walkthroughMesh = _makeWalkthroughMesh('Q');
                walkthroughMesh.position.y = 0.1;

                const {left: leftControllerMesh} = controllerMeshes;
                leftControllerMesh.add(walkthroughMesh);
                return walkthroughMesh;
              })();
              result.padButtonMesh = padButtonMesh;

              const gripButtonMesh = (() => {
                const walkthroughMesh = _makeWalkthroughMesh('F');
                walkthroughMesh.position.y = 0.1;

                const {left: leftControllerMesh} = controllerMeshes;
                leftControllerMesh.add(walkthroughMesh);
                return walkthroughMesh;
              })();
              result.gripButtonMesh = gripButtonMesh;

              const xyMoveMesh = (() => {
                const walkthroughMesh = _makeWalkthroughMesh('<span>Ctrl + </span>$MOUSE');
                walkthroughMesh.position.y = 0.1;

                const {left: leftControllerMesh} = controllerMeshes;
                leftControllerMesh.add(walkthroughMesh);
                return walkthroughMesh;
              })();
              result.xyMoveMesh = xyMoveMesh;

              const xzMoveMesh = (() => {
                const walkthroughMesh = _makeWalkthroughMesh('Alt + $MOUSE');
                walkthroughMesh.position.y = 0.1;

                const {left: leftControllerMesh} = controllerMeshes;
                leftControllerMesh.add(walkthroughMesh);
                return walkthroughMesh;
              })();
              result.xzMoveMesh = xzMoveMesh;

              const padMesh = (() => {
                const walkthroughMesh = _makeWalkthroughMesh('X + $MOUSE');
                walkthroughMesh.position.y = 0.1;

                const {left: leftControllerMesh} = controllerMeshes;
                leftControllerMesh.add(walkthroughMesh);
                return walkthroughMesh;
              })();
              result.padMesh = padMesh;

              const targetMesh = (() => {
                const object = new THREE.Object3D();
                object.position.y = 2;
                object.position.z = -0.5;
                object.visible = false;

                const numRings = 4;
                for (let i = 0; i < numRings; i++) {
                  const ringMesh = (() => {
                    const geometry = new THREE.TorusBufferGeometry(0.05 * (i + 0.5), 0.05, 3, 8);
                    const material = solidMaterials[(i % 2) === 0 ? 'red' : 'white'];

                    const mesh = new THREE.Mesh(geometry, material);
                    return mesh;
                  })();
                  object.add(ringMesh);
                }

                scene.add(object);

                object.updateMatrixWorld();
                const {position, rotation, scale} = _decomposeObjectMatrixWorld(object);
                const boxTarget = geometryUtils.makeBoxTarget(
                  position,
                  rotation,
                  scale,
                  new THREE.Vector3((0.05 * (numRings + 0.5)) * 2, (0.05 * (numRings + 0.5)) * 2, 0.05 * 2)
                );
                object.boxTarget = boxTarget;

                return object;
              })();
              result.targetMesh = targetMesh;

              const goalMesh = (() => {
                const object = new THREE.Object3D();
                object.position.y = 5 / 2;
                object.position.z = -5;
                object.visible = false;

                const cylinderMesh = (() => {
                  const geometry = new THREE.CylinderBufferGeometry(1, 1, 5, 10, 1, true);
                  const material = transparentMaterials.red;

                  const mesh = new THREE.Mesh(geometry, material);
                  mesh.rotation.order = camera.rotation.order;
                  return mesh;
                })();
                object.add(cylinderMesh);
                object.cylinderMesh = cylinderMesh;

                scene.add(object);

                object.updateMatrixWorld();
                const {position, rotation, scale} = _decomposeObjectMatrixWorld(object);
                const boxTarget = geometryUtils.makeBoxTarget(
                  position,
                  rotation,
                  scale,
                  new THREE.Vector3(1 * 2, 5, 1 * 2)
                );
                object.boxTarget = boxTarget;

                return object;
              })();
              result.goalMesh = goalMesh;

              const touchMesh1 = (() => {
                const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1);
                const material = transparentMaterials.red;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.order = camera.rotation.order;
                mesh.position.set(0.5, 2, 0);
                mesh.visible = false;

                scene.add(mesh);

                mesh.updateMatrixWorld();
                const {position, rotation, scale} = _decomposeObjectMatrixWorld(mesh);
                const boxTarget = geometryUtils.makeBoxTarget(
                  position,
                  rotation,
                  scale,
                  new THREE.Vector3(0.1, 0.1, 0.1)
                );
                mesh.boxTarget = boxTarget;

                return mesh;
              })();
              result.touchMesh1 = touchMesh1;

              const touchMesh2 = (() => {
                const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1);
                const material = transparentMaterials.red;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.order = camera.rotation.order;
                mesh.position.set(0.5, 2, -0.5);
                mesh.visible = false;

                scene.add(mesh);

                mesh.updateMatrixWorld();
                const {position, rotation, scale} = _decomposeObjectMatrixWorld(mesh);
                const boxTarget = geometryUtils.makeBoxTarget(
                  position,
                  rotation,
                  scale,
                  new THREE.Vector3(0.1, 0.1, 0.1)
                );
                mesh.boxTarget = boxTarget;

                return mesh;
              })();
              result.touchMesh2 = touchMesh2;

              const legoMesh = (() => {
                const object = new THREE.Object3D();
                object.position.y = 1.5;
                object.position.x = 1;
                object.visible = false;

                const outerMesh = (() => {
                  const result = new THREE.Object3D();
                  result.position.x = -0.05 / 2;

                  [
                    [0, 0],
                    [-1, 1],
                    [-1, 0],
                    [-1, -1],
                  ].forEach(coord => {
                    const boxMesh = (() => {
                      const geometry = new THREE.BoxBufferGeometry(0.05, 0.05, 0.05);
                      const material = solidMaterials.blue;

                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.position.x = coord[0] * 0.05;
                      mesh.position.y = coord[1] * 0.05;
                      return mesh;
                    })();
                    result.add(boxMesh);
                  });

                  return result;
                })();
                object.add(outerMesh);
                object.outerMesh = outerMesh;

                const innerMesh = (() => {
                  const result = new THREE.Object3D();

                  [
                    [0, 1],
                    [1, 1],
                    [1, 0],
                    [1, -1],
                    [0, -1],
                  ].forEach(coord => {
                    const boxMesh = (() => {
                      const geometry = new THREE.BoxBufferGeometry(0.05, 0.05, 0.05);
                      const material = solidMaterials.green;

                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.position.x = coord[0] * 0.05;
                      mesh.position.y = coord[1] * 0.05;
                      return mesh;
                    })();
                    result.add(boxMesh);
                  });

                  return result;
                })();
                object.add(innerMesh);
                object.innerMesh = innerMesh;

                scene.add(object);

                object.updateMatrixWorld();

                [outerMesh, innerMesh].forEach(subMesh => {
                  const {position, rotation, scale} = _decomposeObjectMatrixWorld(subMesh);
                  const boxTarget = geometryUtils.makeBoxTarget(
                    position,
                    rotation,
                    scale,
                    new THREE.Vector3(0.05, 0.05, 0.05)
                  );
                  subMesh.boxTarget = boxTarget;
                });

                return object;
              })();
              result.legoMesh = legoMesh;

              const padTargetMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(0.043, 0.043 / 4, 0.043 / 4);
                const material = transparentMaterials.red;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 0.046 - ((0.043 / 4) / 2);
                mesh.visible = false;

                const {circleMesh} = hudMesh;
                circleMesh.add(mesh);

                return mesh;
              })();
              result.padTargetMesh = padTargetMesh;

              return result;
            })();
            const walkthroughEmitter = new EventEmitter();
            const WALKTHROUGH_SCRIPTS = [
              () => {
                const mesh = walkthroughMeshes.controllerLabelMeshes.right;
                mesh.visible = true;

                const keydown = e => {
                  if (e.keyCode === 67) { // C
                    _setNextWalkthroughIndex();
                  }
                };
                input.on('keydown', keydown);

                return () => {
                  input.removeListener('keydown', keydown);

                  mesh.visible = false;
                };
              },
              () => {
                const mesh = walkthroughMeshes.controllerLabelMeshes.left;
                mesh.visible = true;

                const keydown = e => {
                  if (e.keyCode === 90) { // Z
                    _setNextWalkthroughIndex();
                  }
                };
                input.on('keydown', keydown);

                return () => {
                  input.removeListener('keydown', keydown);

                  mesh.visible = false;
                };
              },
              () => {
                const meshes = [walkthroughMeshes.clickLabelMesh, walkthroughMeshes.targetMesh];
                meshes.forEach(mesh => {
                  mesh.visible = true;
                });

                const boxAnchor = {
                  boxTarget: walkthroughMeshes.targetMesh.boxTarget,
                  anchor: {
                    onclick: 'tutorial:target',
                  },
                };
                rend.addBoxAnchor(boxAnchor);

                const triggerdown = e => {
                  const {side} = e;
                  const hoverState = rend.getHoverState(side);
                  const {type} = hoverState;

                  if (type === 'boxAnchor') {
                    const {anchor} = hoverState;
                    const onclick = (anchor && anchor.onclick) || '';

                    if (onclick === 'tutorial:target') {
                      _setNextWalkthroughIndex();
                    }
                  }
                };
                input.on('triggerdown', triggerdown);

                return () => {
                  input.removeListener('triggerdown', triggerdown);

                  meshes.forEach(mesh => {
                    mesh.visible = false;
                  });

                  rend.removeBoxAnchor(boxAnchor);
                };
              },
              () => {
                const mesh = walkthroughMeshes.menuButtonMesh1;
                mesh.visible = true;

                const keydown = e => {
                  if (e.keyCode === 69) { // E
                    _setNextWalkthroughIndex();
                  }
                };
                input.on('keydown', keydown);

                return () => {
                  input.removeListener('keydown', keydown);

                  mesh.visible = false;
                };
              },
              () => {
                const mesh = walkthroughMeshes.menuButtonMesh2;
                mesh.visible = true;

                const keydown = e => {
                  if (e.keyCode === 69) { // E
                    _setNextWalkthroughIndex();
                  }
                };
                input.on('keydown', keydown);

                return () => {
                  input.removeListener('keydown', keydown);

                  mesh.visible = false;
                };
              },
              () => {
                const meshes = [walkthroughMeshes.padButtonMesh, walkthroughMeshes.goalMesh];
                meshes.forEach(mesh => {
                  mesh.visible = true;
                });

                const intersect = mesh => {
                  if (mesh === walkthroughMeshes.goalMesh) {
                    _setNextWalkthroughIndex();
                  }
                };
                walkthroughEmitter.on('intersect', intersect);

                return () => {
                  walkthroughEmitter.removeListener('intersect', intersect);

                  meshes.forEach(mesh => {
                    mesh.visible = false;
                  });
                };
              },
              () => {
                const meshes = [walkthroughMeshes.gripButtonMesh, walkthroughMeshes.legoMesh];
                meshes.forEach(mesh => {
                  mesh.visible = true;
                });

                const intersect = mesh => {
                  if (mesh === walkthroughMeshes.legoMesh.innerMesh) {
                    _setNextWalkthroughIndex();
                  }
                };
                walkthroughEmitter.on('intersect', intersect);

                return () => {
                  walkthroughEmitter.removeListener('intersect', intersect);

                  meshes.forEach(mesh => {
                    mesh.visible = false;
                  });
                };
              },
              () => {
                const meshes = [walkthroughMeshes.xyMoveMesh, walkthroughMeshes.touchMesh1];
                meshes.forEach(mesh => {
                  mesh.visible = true;
                });

                const intersect = mesh => {
                  if (mesh === walkthroughMeshes.touchMesh1) {
                    _setNextWalkthroughIndex();
                  }
                };
                walkthroughEmitter.on('intersect', intersect);

                return () => {
                  walkthroughEmitter.removeListener('intersect', intersect);

                  meshes.forEach(mesh => {
                    mesh.visible = false;
                  });
                };
              },
              () => {
                const meshes = [walkthroughMeshes.xzMoveMesh, walkthroughMeshes.touchMesh2];
                meshes.forEach(mesh => {
                  mesh.visible = true;
                });

                const intersect = mesh => {
                  if (mesh === walkthroughMeshes.touchMesh2) {
                    _setNextWalkthroughIndex();
                  }
                };
                walkthroughEmitter.on('intersect', intersect);

                return () => {
                  walkthroughEmitter.removeListener('intersect', intersect);

                  meshes.forEach(mesh => {
                    mesh.visible = false;
                  });
                };
              },
              () => {
                const meshes = [walkthroughMeshes.padMesh, walkthroughMeshes.padTargetMesh];
                meshes.forEach(mesh => {
                  mesh.visible = true;
                });

                const intersect = mesh => {
                  if (mesh === walkthroughMeshes.padTargetMesh) {
                    _setPage('video:' + 0);
                  }
                };
                walkthroughEmitter.on('intersect', intersect);

                return () => {
                  walkthroughEmitter.removeListener('intersect', intersect);

                  meshes.forEach(mesh => {
                    mesh.visible = false;
                  });
                };
              },
              null,
            ];
            let walkthroughIndex = 0;
            let walkthroughCancel = null;
            const _setWalkthroughIndex = n => {
              if (walkthroughCancel) {
                walkthroughCancel();
                walkthroughCancel = null;
              }

              walkthroughIndex = n;

              const script = WALKTHROUGH_SCRIPTS[n];
              if (script) {
                walkthroughCancel = script();
              }
            };
            const _setNextWalkthroughIndex = () => _setWalkthroughIndex(walkthroughIndex + 1);

            const _updatePages = () => {
              const {planeMesh} = tutorialMesh;
              const {page} = planeMesh;
              page.update();
            };
            _updatePages();

            const _parsePage = page => {
              const split = page.split(':');
              const name = split[0];
              const args = split.slice(1);
              return {
                name,
                args,
              };
            };
            const _setPage = page => {
              const isTutorialPage = /^(?:controls|videos|video:[0-9]+)$/.test(page);
              if (isTutorialPage && !bootstrap.getTutorialFlag()) {
                bootstrap.setTutorialFlag(true);
              } else if (!isTutorialPage && bootstrap.getTutorialFlag()) {
                bootstrap.setTutorialFlag(false);
              }
              if (page === 'controls') {
                _setWalkthroughIndex(0);
              } else {
                _setWalkthroughIndex(10);
              }

              const {videoMesh} = tutorialMesh;
              const {viewportMesh: {material: {map: texture}}} = videoMesh;
              const {image: media} = texture;
              if (media.tagName === 'VIDEO' && !media.paused) {
                media.pause();
              }
              let match;
              if (match = page.match(/^video:([0-9]+)$/)) {
                const id = parseInt(match[1], 10);

                videoMesh.visible = true;
                const video = (() => {
                  const video = document.createElement('video');
                  video.crossOrigin = 'Anonymous';
                  video.oncanplaythrough = () => {
                    texture.image = video;
                    texture.needsUpdate = true;

                    const {soundBody} = videoMesh;
                    soundBody.setInputElement(video);

                    video.oncanplaythrough = null;
                    video.onerror = null;
                  };
                  video.onerror = err => {
                    console.warn(err);
                  };
                  video.src = videos[id].video;
                  return video;
                })();
                texture.image = transparentImg;
                texture.needsUpdate = true;
              } else {
                videoMesh.visible = false;
              }

              mediaState.paused = true;
              mediaState.value = 0;
              const {controlsMesh} = videoMesh;
              const {page: controlsPage} = controlsMesh;
              controlsPage.update();

              if (page !== 'done') {
                homeState.page = page;

                _updatePages();
              } else {
                rend.setTab('status');
              }
            };
            _setPage(bootstrap.getTutorialFlag() ? 'controls' : 'done');

            const _trigger = e => {
              const {side} = e;

              /* const _proxyLoginServer = worldname => fetch('servers/proxyLogin', {
                method: 'POST',
                headers: (() => {
                  const result = new Headers();
                  result.append('Content-Type', 'application/json');
                  return result;
                })(),
                body: JSON.stringify({
                  worldname: worldname,
                }),
              })
                .then(res => res.json()
                  .then(({token}) => token)
                );
               const _doEnvMeshClick = () => { // XXX integrate this into the rend engine menu
                const envHoverState = envHoverStates[side];
                const {hoveredServerMesh} = envHoverState;

                if (hoveredServerMesh) {
                  const {server} = hoveredServerMesh;
                  const {running} = server;

                  if (running) {
                    const {url: serverUrl} = server;

                    const _connectServer = (token = null) => {
                      window.parent.location = serverUrl + (token ? ('?t=' + token) : '');
                    };

                    const {local} = server;
                    if (local) {
                      fetch(serverUrl + '/server/checkLogin', {
                        method: 'POST',
                      })
                        .then(res => res.json()
                          .then(({ok}) => {
                            if (ok) {
                              _connectServer();
                            } else {
                              const {worldname} = server;

                              _proxyLoginServer(worldname)
                                .then(token => {
                                  _connectServer(token);
                                })
                                .catch(err => {
                                  console.warn(err);
                                });
                            }
                          })
                        )
                        .catch(err => {
                          console.warn(err);

                          const {worldname} = server;

                          _proxyLoginServer(worldname)
                            .then(token => {
                              _connectServer(token);
                            })
                            .catch(err => {
                              console.warn(err);
                            });
                        });
                    } else {
                      _connectServer();
                    }

                    e.stopImmediatePropagation();
                  }

                  return true;
                } else {
                  return false;
                }
              }; */
              const _doMenuMeshClick = () => {
                const hoverState = rend.getHoverState(side);
                const {anchor} = hoverState;
                const onclick = (anchor && anchor.onclick) || '';

                let match;
                if (onclick === 'home:next') {
                  const {page} = homeState;
                  const pageSpec = _parsePage(page);
                  const {name} = pageSpec;

                  if (name === 'controls') {
                    _setPage('video:' + 0);
                  } else if (name === 'videos') {
                    _setPage('video:' + 0);
                  } else if (name === 'video') {
                    const n = parseInt(pageSpec.args[0], 10);

                    if (n < 4) {
                      _setPage([pageSpec.name, n + 1].join(':'));
                    } else {
                      _setPage('done');
                    }                    
                  }

                  return true;
                } else if (onclick === 'home:back') {
                  const {page} = homeState;
                  const pageSpec = _parsePage(page);
                  const {name} = pageSpec;

                  if (name === 'videos') {
                    _setPage('controls');
                  } else if (name === 'video') {
                    const n = parseInt(pageSpec.args[0], 10);

                    if (n > 0) {
                      _setPage([pageSpec.name, n - 1].join(':'));
                    } else {
                      _setPage('videos');
                    }
                  } else if (name === 'done') {
                    _setPage('videos');
                  }

                  return true;
                } else if (match = onclick.match(/^home:video:([0-9]+)$/)) {
                  const n = parseInt(match[1], 10);

                  _setPage('video:' + n);

                  return true;
                } else if (onclick === 'home:skipAll') {
                  _setPage('done');

                  return true;
                } else if (match = onclick.match(/^media:(play|pause|seek)$/)) {
                  const action = match[1];

                  const {videoMesh} = tutorialMesh;
                  const {viewportMesh: {material: {map: {image: media}}}} = videoMesh;
                  if (action === 'play') {
                    if (media.paused) {
                      media.play();

                      mediaState.paused = false;

                      const {controlsMesh} = videoMesh;
                      const {page} = controlsMesh;
                      page.update();
                    }
                  } else if (action === 'pause') {
                    if (!media.paused) {
                      media.pause();

                      mediaState.paused = true;

                      const {controlsMesh} = videoMesh;
                      const {page} = controlsMesh;
                      page.update();
                    }
                  } else if (action === 'seek') {
                    const {value} = hoverState;
                    media.currentTime = value * media.duration;

                    mediaState.value = value;
                    const {controlsMesh} = videoMesh;
                    const {page} = controlsMesh;
                    page.update();
                  }

                  return true;
                } else {
                  return false;
                }
              };

              _doMenuMeshClick();
            };
            input.on('trigger', _trigger, {
              priority: 1,
            });

            const _tabchange = tab => {
              if (tab === 'tutorial') {
                _setPage('controls');
              }
            };
            rend.on('tabchange', _tabchange);
            const _update = () => {
              const _updateWalkthroughMeshes = () => {
                const uiTime = biolumi.getUiTime();

                const v = (uiTime / 1000 * Math.PI * 0.1) % (Math.PI * 2);

                const {targetMesh} = walkthroughMeshes;
                targetMesh.rotation.z = v;

                const {goalMesh} = walkthroughMeshes;
                goalMesh.rotation.y = v;

                const {touchMesh1, touchMesh2} = walkthroughMeshes;
                [touchMesh1, touchMesh2].forEach(touchMesh => {
                  touchMesh.rotation.x = v;
                  touchMesh.rotation.y = v;
                });
              };
              const _updateWalkthroughEmitter = () => {
                const {hmd, gamepads} = webvr.getStatus();

                const {goalMesh} = walkthroughMeshes;
                const {position: hmdPosition} = hmd;
                [goalMesh].forEach(targetMesh => {
                  const {boxTarget} = targetMesh;

                  if (boxTarget.containsPoint(hmdPosition)) {
                    walkthroughEmitter.emit('intersect', targetMesh);
                  }
                });

                const {touchMesh1, touchMesh2, legoMesh: {outerMesh: legoOuterMesh, innerMesh: legoInnerMesh}} = walkthroughMeshes;
                SIDES.forEach(side => {
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    const {position: controllerPosition} = gamepad;

                    [touchMesh1, touchMesh2, legoOuterMesh, legoInnerMesh].forEach(targetMesh => {
                      const {boxTarget} = targetMesh;

                      if (boxTarget.containsPoint(controllerPosition)) {
                        walkthroughEmitter.emit('intersect', targetMesh);
                      }
                    });
                  }
                });

                const {padTargetMesh} = walkthroughMeshes;
                SIDES.forEach(side => {
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    const {axes} = gamepad;

                    if (Math.abs(axes[0]) < 0.5 && axes[1] > 0.8) {
                      walkthroughEmitter.emit('intersect', padTargetMesh);
                    }
                  }
                });
              };
              const _updateVideo = () => {
                const {videoMesh} = tutorialMesh;
                const {viewportMesh: {material: {map: texture}}} = videoMesh;
                const {image: media} = texture;

                if (videoMesh.visible && media.tagName === 'VIDEO') {
                  const {value: prevValue} = mediaState;
                  const nextValue = media.currentTime / media.duration;

                  if (Math.abs(nextValue - prevValue) >= (1 / 1000)) { // to reduce the frequency of texture updates
                    mediaState.value = nextValue;

                    const {controlsMesh} = videoMesh;
                    const {page} = controlsMesh;
                    page.update();
                  }

                  texture.needsUpdate = true;
                }
              };

              _updateWalkthroughMeshes();
              _updateWalkthroughEmitter();
              _updateVideo();
            };
            rend.on('update', _update);

            cleanups.push(() => {
              // bootstrap.removeListener('vrModeChange', _vrModeChange);

              input.removeListener('trigger', _trigger);

              rend.removeListener('tabchange', _tabchange);
              rend.removeListener('update', _update);
            });
          }
        });
    }
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Home;
