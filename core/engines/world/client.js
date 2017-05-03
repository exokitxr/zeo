import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  TAGS_WIDTH,
  TAGS_HEIGHT,
  TAGS_WORLD_WIDTH,
  TAGS_WORLD_HEIGHT,
  TAGS_WORLD_DEPTH,
} from './lib/constants/world';
import worldRenderer from './lib/render/world';
import menuUtils from './lib/utils/menu';

const TAGS_PER_ROW = 4;
const TAGS_ROWS_PER_PAGE = 6;
const TAGS_PER_PAGE = TAGS_PER_ROW * TAGS_ROWS_PER_PAGE;
const NPM_TAG_MESH_SCALE = 1.5;
const DEFAULT_USER_HEIGHT = 1.6;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const SIDES = ['left', 'right'];

class World {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {home: {enabled: homeEnabled}, server: {enabled: serverEnabled}}} = archae;

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

    const _requestDefaultTags = () => {
      if (homeEnabled) {
        return fetch('/archae/home/defaults/data/world/tags.json')
          .then(res => res.json()
            .then(({tags}) => Object.keys(tags).map(id => tags[id]))
          );
      } else {
        return Promise.resolve();
      }
    };

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/input',
        '/core/engines/webvr',
        '/core/engines/cyborg',
        '/core/engines/multiplayer',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/engines/wallet',
        '/core/engines/keyboard',
        '/core/engines/loader',
        '/core/engines/tags',
        '/core/engines/fs',
        '/core/utils/network-utils',
        '/core/utils/geometry-utils',
      ]),
      _requestDefaultTags(),
    ]).then(([
      [
        three,
        input,
        webvr,
        cyborg,
        multiplayer,
        biolumi,
        rend,
        wallet,
        keyboard,
        loader,
        tags,
        fs,
        networkUtils,
        geometryUtils,
      ],
      defaultTags,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {AutoWs} = networkUtils;

        const transparentMaterial = biolumi.getTransparentMaterial();

        const wireframeHighlightMaterial = new THREE.MeshBasicMaterial({
          color: 0x0000FF,
          wireframe: true,
          opacity: 0.5,
          transparent: true,
        });

        const mainFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 36,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };

        const oneVector = new THREE.Vector3(1, 1, 1);
        const zeroVector = new THREE.Vector3(0, 0, 0);
        const zeroQuaternion = new THREE.Quaternion();
        const controllerMeshOffset = new THREE.Vector3(0, 0, -0.02);
        const controllerMeshQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const localUserId = multiplayer.getId();
        const _makeTriggerState = () => ({
          triggered: false,
        });
        const triggerStates = {
          left: _makeTriggerState(),
          right: _makeTriggerState(),
        };

        const _getInFrontOfCameraMatrix = () => {
          const {hmd} = webvr.getStatus();
          const {position, rotation} = hmd;

          const newPosition = position.clone().add(new THREE.Vector3(0, 0, -0.5).applyQuaternion(rotation));
          const newRotation = rotation;
          const newScale = oneVector;

          return newPosition.toArray().concat(newRotation.toArray()).concat(newScale.toArray());
        };

        class ElementManager {
          constructor() {
            this.tagMeshes = {};
          }

          getTagMeshes() {
            const {tagMeshes} = this;

            const result = [];
            for (const k in tagMeshes) {
              const tagMesh = tagMeshes[k];
              result.push(tagMesh);
            }
            return result;
          }

          getTagMesh(id) {
            return this.tagMeshes[id];
          }

          add(tagMesh) {
            const {tagMeshes} = this;
            const {item} = tagMesh;
            const {id} = item;
            tagMeshes[id] = tagMesh;

            if (!rend.isOpen()) {
              tagMesh.visible = false;
            }

            scene.add(tagMesh);
          }

          remove(tagMesh) {
            const {tagMeshes} = this;
            const {item} = tagMesh;
            const {id} = item;
            delete tagMeshes[id];

            tagMesh.parent.remove(tagMesh);
          }
        }
        const elementManager = new ElementManager();

        class GrabManager {
          constructor() {
            this.left = null;
            this.right = null;
          }

          getMesh(side) {
            return this[side];
          }

          setMesh(side, mesh) {
            this[side] = mesh;
          }

          isGrabbed() {
            return SIDES.some(side => this[side] !== null);
          }
        }
        const grabManager = new GrabManager();

        class RemoteGrabManager {
          constructor() {
            this.managers = {};

            multiplayer.getPlayerStatuses().forEach((status, userId) => {
              this.addManager(userId);
            });

            const _playerEnter = update => {
              const {id: userId} = update;

              this.addManager(userId);
            };
            multiplayer.on('playerEnter', _playerEnter);
            const _playerLeave = update => {
              const {id: userId} = update;

              this.removeManager(userId);
            };
            multiplayer.on('playerLeave', _playerLeave);

            this._cleanup = () => {
              multiplayer.removeListener('playerEnter', _playerEnter);
              multiplayer.removeListener('playerLeave', _playerLeave);
            };
          }

          getManager(userId) {
            return this.managers[userId];
          }

          addManager(userId) {
            const manager = new GrabManager();
            manager.userId = userId;

            this.managers[userId] = manager;
          }

          removeManager(userId) {
            delete this.managers[userId];
          }

          isGrabbed() {
            const {managers} = this;

            for (const userId in managers) {
              const manager = managers[userId];

              if (manager.isGrabbed()) {
                return true;
              }
            }

            return false;
          }

          destroy() {
            this._cleanup();
          }
        }
        const remoteGrabManager = new RemoteGrabManager();

        let npmTagMeshes = [];

        const requestHandlers = new Map();
        const _request = (method, args, cb) => {
          if (connection) {
            const id = _makeId();

            const e = {
              method,
              args,
              id,
            };
            const es = JSON.stringify(e);
            connection.send(es);

            const requestHandler = (err, result) => {
              if (!err) {
                cb(null, result);
              } else {
                cb(err);
              }

              requestHandlers.delete(id);
            };
            requestHandlers.set(id, requestHandler);
          } else {
            setTimeout(() => {
              cb(null);
            });
          }
        };
        const _addTag = (itemSpec, dst, {element = null} = {}) => {
          _handleAddTag(localUserId, itemSpec, dst, {element});

          _request('addTag', [localUserId, itemSpec, dst], _warnError);
        };
        const _removeTag = src => {
          _handleRemoveTag(localUserId, src);

          _request('removeTag', [localUserId, src], _warnError);
        };
        const _moveTag = (src, dst) => {
          _handleMoveTag(localUserId, src, dst);

          _request('moveTag', [localUserId, src, dst], _warnError);
        };

        const _handleAddTag = (userId, itemSpec, dst, {element = null} = {}) => {
          const isMe = userId === localUserId;

          let match;
          if (dst === 'world') {
            const tagMesh = tags.makeTag(itemSpec);
            if (element) { // manually added
              const {item} = tagMesh;
              element.item = item;
              item.instance = element;
            }

            const {item: {type}} = tagMesh;
            if (type === 'module') {
              tags.reifyModule(tagMesh);
            } else if (type === 'entity') {
              tags.reifyEntity(tagMesh);
            }

            elementManager.add(tagMesh);
          } else if (match = dst.match(/^hand:(left|right)$/)) {
            const side = match[1];

            const tagMesh = tags.makeTag(itemSpec);
            if (element) { // manually added
              const {item} = tagMesh;
              element.item = item;
              item.instance = element;
            }

            const {item: {type}} = tagMesh;
            if (type === 'module') {
              tags.reifyModule(tagMesh);
            } else if (type === 'entity') {
              tags.reifyEntity(tagMesh);
            }

            const userGrabManager = isMe ? grabManager : remoteGrabManager.getManager(userId);
            const userControllerMeshes = (() => {
              if (isMe) {
                const controllers = cyborg.getControllers();
                return {
                  left: controllers.left.mesh,
                  right: controllers.right.mesh,
                };
              } else {
                const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                const {controllers: controllerMeshes} = remotePlayerMesh;
                return controllerMeshes;
              }
            })();

            userGrabManager.setMesh(side, tagMesh);

            const controllerMesh = userControllerMeshes[side];
            tagMesh.position.copy(controllerMeshOffset);
            tagMesh.quaternion.copy(controllerMeshQuaternion);
            tagMesh.scale.copy(oneVector);
            controllerMesh.add(tagMesh);
          } else {
            console.warn('invalid add tag arguments', {userId, itemSpec, dst});
          }
        };
        const _handleRemoveTag = (userId, src) => {
          const isMe = userId === localUserId;

          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];
            const tagMesh = elementManager.getTagMesh(id);

            const {item: {type}} = tagMesh;
            if (type === 'module') {
              tags.unreifyModule(tagMesh);
            } else if (type === 'entity') {
              tags.unreifyEntity(tagMesh);
            }

            elementManager.remove(tagMesh);
            tags.destroyTag(tagMesh);
          } else if (match = src.match(/^hand:(left|right)$/)) {
            const side = match[1];

            const userGrabManager = isMe ? grabManager : remoteGrabManager.getManager(userId);

            const tagMesh = userGrabManager.getMesh(side);

            const {item: {type}} = tagMesh;
            if (type === 'module') {
              tags.unreifyModule(tagMesh);
            } else if (type === 'entity') {
              tags.unreifyEntity(tagMesh);
            }

            elementManager.remove(tagMesh);
            tags.destroyTag(tagMesh);

            userGrabManager.setMesh(side, null);
          } else {
            console.warn('invalid remove tag arguments', {userId, itemSpec, src});
          }
        };
        const _handleMoveTag = (userId, src, dst) => {
          const isMe = userId === localUserId;

          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            if (match = dst.match(/^hand:(left|right)$/)) {
              const side = match[1];

              const userGrabManager = isMe ? grabManager : remoteGrabManager.getManager(userId);
              const userControllerMeshes = (() => {
                if (isMe) {
                  const controllers = cyborg.getControllers();
                  return {
                    left: controllers.left.mesh,
                    right: controllers.right.mesh,
                  };
                } else {
                  const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                  const {controllers: controllerMeshes} = remotePlayerMesh;
                  return controllerMeshes;
                }
              })();

              const tagMesh = elementManager.getTagMesh(id);

              userGrabManager.setMesh(side, tagMesh);

              const controllerMesh = userControllerMeshes[side];
              controllerMesh.add(tagMesh);
              tagMesh.position.copy(controllerMeshOffset);
              tagMesh.quaternion.copy(controllerMeshQuaternion);
              tagMesh.scale.copy(oneVector)
            } else {
              console.warn('invalid move tag arguments', {src, dst});
            }
          } else if (match = src.match(/^hand:(left|right)$/)) {
            const side = match[1];

            const userGrabManager = isMe ? grabManager : remoteGrabManager.getManager(userId);
            const tagMesh = userGrabManager.getMesh(side);

            if (match = dst.match(/^world:(.+)$/)) {
              const matrixArrayString = match[1];
              const matrixArray = JSON.parse(matrixArrayString);

              tagMesh.position.set(matrixArray[0], matrixArray[1], matrixArray[2]);
              tagMesh.quaternion.set(matrixArray[3], matrixArray[4], matrixArray[5], matrixArray[6]);
              tagMesh.scale.set(matrixArray[7], matrixArray[8], matrixArray[9]);

              const {item} = tagMesh;
              item.matrix = matrixArray;

              elementManager.add(tagMesh);

              userGrabManager.setMesh(side, null);
            } else {
              console.warn('invalid move tag arguments', {src, dst});
            }
          } else {
            console.warn('invalid move tag arguments', {src, dst});
          }
        };
        const _handleSetTagAttribute = (userId, src, {name, value}) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.setAttribute(name, value);

            return tagMesh;
          } else {
            console.warn('invalid set tag attribute arguments', {src, name, value});

            return null;
          }
        };
        const _handleTagOpen = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.open();
          } else {
            console.warn('invalid tag open arguments', {src});
          }
        };
        const _handleTagClose = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.close();
          } else {
            console.warn('invalid tag open arguments', {src});
          }
        };
        const _handleTagOpenDetails = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^(world|npm|asset):(.+)$/)) {
            const type = match[1];
            const id = match[2];

            const tagMesh = (() => {
              if (type === 'world') {
                return elementManager.getTagMesh(id);
              } else if (type === 'npm') {
                return npmTagMeshes.find(tagMesh => tagMesh.item.id === id);
              } else if (type === 'asset') {
                return wallet.getAssetTagMeshes().find(tagMesh => tagMesh.item.id === id);
              } else {
                return null;
              }
            })();
            tagMesh.openDetails();
          } else {
            console.warn('invalid tag open details arguments', {src});
          }
        };
        const _handleTagCloseDetails = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^(world|npm|asset):(.+)$/)) {
            const type = match[1];
            const id = match[2];

            const tagMesh = (() => {
              if (type === 'world') {
                return elementManager.getTagMesh(id);
              } else if (type === 'npm') {
                return npmTagMeshes.find(tagMesh => tagMesh.item.id === id);
              } else if (type === 'asset') {
                return wallet.getAssetTagMeshes().find(tagMesh => tagMesh.item.id === id);
              } else {
                return null;
              }
            })();
            tagMesh.closeDetails();
          } else {
            console.warn('invalid tag close details arguments', {src});
          }
        };
        const _handleTagPlay = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.play();
          } else {
            console.warn('invalid tag play arguments', {src});
          }
        };
        const _handleTagPause = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.pause();
          } else {
            console.warn('invalid tag pause arguments', {src});
          }
        };
        const _handleTagSeek = (userId, src, value) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.seek(value);
          } else {
            console.warn('invalid tag seek arguments', {src, value});
          }
        };
        const _handleLoadModule = (userId, plugin) => {
          loader.requestPlugin(plugin)
            .catch(err => {
              console.warn(err);
            });
        };
        const _handleUnloadModule = (userId, pluginName) => {
          loader.releasePlugin(pluginName)
            .catch(err => {
              console.warn(err);
            });
        };
        const _handleMessage = detail => {
          tags.message(detail);
        };

        const _searchNpm = (q = '') => fetch('archae/rend/search?q=' + encodeURIComponent(q))
          .then(res => res.json());
        const _updateNpm = menuUtils.debounce(next => {
          const {inputText} = npmState;

          _searchNpm(inputText)
            .then(itemSpecs => itemSpecs.map(itemSpec => {
              itemSpec.metadata.isStatic = true; // XXX can probably be hardcoded in the render
              itemSpec.metadata.exists = elementManager.getTagMeshes()
                .some(tagMesh =>
                  tagMesh.item.type === itemSpec.type &&
                  tagMesh.item.name === itemSpec.name
                );

              const npmTagMesh = tags.makeTag(itemSpec, {
                initialUpdate: false,
              });
              npmTagMesh.planeMesh.scale.set(NPM_TAG_MESH_SCALE, NPM_TAG_MESH_SCALE, 1);

              return npmTagMesh;
            }))
            .then(tagMeshes => {
              const {tagMeshes: oldTagMeshes} = npmCacheState;

              npmState.loading = false;
              npmState.page = 0;
              npmState.numTags = tagMeshes.length;
              npmCacheState.tagMeshes = tagMeshes;

              const {npmMesh} = worldMesh;
              for (let i = 0; i < oldTagMeshes.length; i++) {
                const oldTagMesh = oldTagMeshes[i];
                npmMesh.remove(oldTagMesh);
                tags.destroyTag(oldTagMesh);
              }
              for (let i = 0; i < tagMeshes.length; i++) {
                const tagMesh = tagMeshes[i];
                tagMesh.visible = false;
                tagMesh.initialVisible = false;
                npmMesh.add(tagMesh);
              }

              _updateNpmTagMeshContainer();
              _updatePages();

              next();
            })
            .catch(err => {
              console.warn(err);

              next();
            });

          const {numTags} = npmState;
          npmState.loading = numTags === 0;

          _updatePages();
        });

        const npmState = {
          loading: false,
          inputText: '',
          numTags: 0,
          page: 0,
        };
        const focusState = {
          keyboardFocusState: null,
        };
        const npmCacheState = {
          tagMeshes: [],
          loaded: false,
        };

        const worldMesh = (() => {
          const result = new THREE.Object3D();
          result.visible = false;

          const menuMesh = (() => {
            const object = new THREE.Object3D();

            const planeMesh = (() => {
              const worldUi = biolumi.makeUi({
                width: WIDTH,
                height: HEIGHT,
              });
              const mesh = worldUi.makePage(({
                npm: {
                  loading,
                  inputText,
                  numTags,
                  page,
                },
                focus: {
                  keyboardFocusState,
                },
              }) => {
                const {type = '', inputValue = 0} = keyboardFocusState || {};
                const focus = type === 'npm';

                return {
                  type: 'html',
                  src: worldRenderer.getWorldPageSrc({loading, inputText, inputValue, numTags, page, focus}),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: HEIGHT,
                };
              }, {
                type: 'world',
                state: {
                  npm: npmState,
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

            const shadowMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
              const material = transparentMaterial;
              const mesh = new THREE.Mesh(geometry, material);
              mesh.castShadow = true;
              return mesh;
            })();
            object.add(shadowMesh);

            return object;
          })();
          result.add(menuMesh);
          result.menuMesh = menuMesh;

          const npmMesh = (() => {
            const object = new THREE.Object3D();
            object.position.z = 0.001;

            const newEntityTagMesh = (() => {
              const newEntityTagMesh = tags.makeTag({
                type: 'entity',
                id: 'entity',
                name: 'new-entity',
                displayName: 'New entity',
                attributes: {},
                matrix: DEFAULT_MATRIX,
                metadata: {
                  isStatic: true,
                },
              });
              newEntityTagMesh.position.set(
                (WORLD_WIDTH / 2) - 0.24,
                (WORLD_HEIGHT / 2) - 0.13,
                0
              );
              newEntityTagMesh.planeMesh.scale.set(NPM_TAG_MESH_SCALE, NPM_TAG_MESH_SCALE, 1);

              return newEntityTagMesh;
            })();
            object.add(newEntityTagMesh);
            object.newEntityTagMesh = newEntityTagMesh;

            return object;
          })();
          result.add(npmMesh);
          result.npmMesh = npmMesh;

          return result;
        })();
        rend.registerMenuMesh('worldMesh', worldMesh);

        const _updatePages = () => {
          const {menuMesh} = worldMesh;
          const {planeMesh} = menuMesh;
          const {page} = planeMesh;
          page.update();
        };
        _updatePages();

        const _update = e => {
          const _updateTagsLinesMesh = () => {
            if (grabManager.isGrabbed() || remoteGrabManager.isGrabbed()) {
              tags.updateLinesMesh();
            }
          };

          _updateTagsLinesMesh();
        };
        rend.on('update', _update);

        const npmCancels = [];
        const _updateNpmTagMeshContainer = () => {
          // hide old
          const oldTagMeshes = npmTagMeshes;
          for (let i = 0; i < oldTagMeshes.length; i++) {
            const oldTagMesh = oldTagMeshes[i];
            oldTagMesh.visible = false;
            oldTagMesh.initialVisible = false;
          }

          // cancel old rendering
          // XXX this has a bug where flipping through pages too fast causes them to not re-render when we flip back to them
          for (let i = 0; i < npmCancels.length; i++) {
            const npmCancel = npmCancels[i];
            npmCancel();
          }
          npmCancels.length = 0;

          // show new
          const {npmMesh} = worldMesh;
          const {page} = npmState;
          const {tagMeshes} = npmCacheState;
          const aspectRatio = 400 / 150;
          const width = TAGS_WORLD_WIDTH * NPM_TAG_MESH_SCALE;
          const height = width / aspectRatio;
          const leftClip = ((30 / WIDTH) * WORLD_WIDTH);
          const rightClip = (((250 + 30) / WIDTH) * WORLD_WIDTH);
          const padding = (WORLD_WIDTH - (leftClip + rightClip) - (TAGS_PER_ROW * width)) / (TAGS_PER_ROW - 1);
          const newTagMeshes = [];
          const startIndex = page * TAGS_PER_PAGE;
          const endIndex = (page + 1) * TAGS_PER_PAGE;
          for (let i = startIndex; i < endIndex && i < tagMeshes.length; i++) {
            const newTagMesh = tagMeshes[i];

            const baseI = i - startIndex;
            const x = baseI % TAGS_PER_ROW;
            const y = Math.floor(baseI / TAGS_PER_ROW);
            newTagMesh.position.set(
              -(WORLD_WIDTH / 2) + (leftClip + (width / 2)) + (x * (width + padding)),
              (WORLD_HEIGHT / 2) - (height / 2) - (y * (height + padding)) - 0.23,
              0
            );
            newTagMesh.planeDetailsMesh.position.copy(
              newTagMesh.planeDetailsMesh.initialOffset.clone().sub(newTagMesh.position)
            );
            newTagMesh.visible = true;
            newTagMesh.initialVisible = true;

            const {planeMesh: newTagMeshPlaneMesh} = newTagMesh;
            const {page: newTagMeshPage} = newTagMeshPlaneMesh;
            const npmCancel = newTagMeshPage.initialUpdate();

            newTagMeshes.push(newTagMesh);
            npmCancels.push(npmCancel);
          }
          npmTagMeshes = newTagMeshes;
        };

        const _tabchange = tab => {
          if (tab === 'world') {
            keyboard.tryBlur();

            const {loaded} = npmCacheState;
            if (!loaded) {
              _updateNpm();

              npmCacheState.loaded = true;
            }
          }
        };
        rend.on('tabchange', _tabchange);

        const _trigger = e => {
          const {side} = e;

          const _clickCast = () => {
            const isOpen = rend.isOpen();

            if (isOpen) {
              const grabMesh = grabManager.getMesh(side);
              const triggerState = triggerStates[side];
              const {triggered} = triggerState;

              if (grabMesh && triggered) {
                const tagMesh = grabMesh;
                const {position, rotation, scale} = _decomposeObjectMatrixWorld(tagMesh);

                const matrixArray = position.toArray().concat(rotation.toArray()).concat(scale.toArray());
                _moveTag('hand:' + side, 'world:' + JSON.stringify(matrixArray));

                triggerState.triggered = false;

                return true;
              } else {
                return false;
              }
            } else {
              return false;
            }
          };
          const _clickMenu = () => {
            const tab = rend.getTab();

            if (tab === 'world') {
              const hoverState = rend.getHoverState(side);
              const {intersectionPoint} = hoverState;

              if (intersectionPoint) {
                const {anchor} = hoverState;
                const onclick = (anchor && anchor.onclick) || '';

                let match;
                if (onclick === 'npm:focus') {
                  const {inputText} = npmState;
                  const {value} = hoverState;
                  const valuePx = value * (WIDTH - (250 + (30 * 2)));
                  const {index, px} = biolumi.getTextPropertiesFromCoord(inputText, mainFontSpec, valuePx); // XXX this can be folded into the keyboard engine
                  const {hmd: {position: hmdPosition, rotation: hmdRotation}} = webvr.getStatus();
                  const keyboardFocusState = keyboard.focus({
                    type: 'npm',
                    position: hmdPosition,
                    rotation: hmdRotation,
                    inputText: inputText,
                    inputIndex: index,
                    inputValue: px,
                    fontSpec: mainFontSpec,
                  });
                  focusState.keyboardFocusState = keyboardFocusState;

                  keyboardFocusState.on('update', () => {
                    const {inputText: keyboardInputText} = keyboardFocusState;
                    const {inputText: npmInputText} = npmState;

                    if (keyboardInputText !== npmInputText) {
                      npmState.inputText = keyboardInputText;

                      // XXX the backend should cache responses to prevent local re-requests from hitting external APIs
                      _updateNpm();

                      _updatePages();
                    }
                  });
                  keyboardFocusState.on('blur', () => {
                    focusState.keyboardFocusState = null;

                    _updatePages();
                  });

                  _updatePages();

                  return true;
                } else if (match = onclick.match(/^npm:(up|down)$/)) {
                  const direction = match[1];

                  npmState.page += (direction === 'up' ? -1 : 1);

                  _updateNpmTagMeshContainer();
                  _updatePages();

                  return true;
                } else {
                  return false;
                }
              } else {
                return false;
              }
            } else {
              return false;
            }
          };

          if (_clickCast() || _clickMenu()) {
            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger, {
          priority: 1,
        });
        const _triggerdown = e => {
          const {side} = e;
          const grabMesh = grabManager.getMesh(side);

          if (grabMesh) {
            const triggerState = triggerStates[side];
            triggerState.triggered = true;

            grabMesh.position.z = -1;
            grabMesh.quaternion.copy(zeroQuaternion);

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerdown', _triggerdown, {
          priority: 1,
        });
        const _gripdown = e => {
          const {side} = e;

          const _grabWorldTagMesh = () => {
            const isOpen = rend.isOpen();

            if (isOpen) {
              const grabMesh = (() => {
                const grabMesh = grabManager.getMesh(side);

                if (!grabMesh) {
                  return tags.getGrabTagMesh(side);
                } else {
                  return null;
                }
              })()

              if (grabMesh) {
                const elementsTagMeshes = elementManager.getTagMeshes();
                const {npmMesh} = worldMesh;
                const {newEntityTagMesh} = npmMesh;

                if (elementsTagMeshes.includes(grabMesh)) {
                  const tagMesh = grabMesh;
                  const {item} = tagMesh;
                  const {id} = item;
                  _moveTag('world:' + id, 'hand:' + side);

                  e.stopImmediatePropagation();

                  return true;
                } else if (npmTagMeshes.includes(grabMesh)) {
                  const tagMesh = grabMesh;
                  const canMakeTag = !(tagMesh.item.metadata.exists || tagMesh.item.instancing); // XXX handle the multi-{user,controller} conflict cases

                  if (canMakeTag) {
                    const item = _clone(tagMesh.item);
                    item.id = _makeId();
                    item.metadata.isStatic = false;
                    _addTag(item, 'hand:' + side);

                    e.stopImmediatePropagation();

                    return true;
                  } else {
                    return false;
                  }
                } else if (grabMesh === newEntityTagMesh) {
                  const tagMesh = grabMesh;
                  const item = _clone(tagMesh.item);
                  item.id = _makeId();
                  item.metadata.isStatic = false;
                  _addTag(item, 'hand:' + side);

                  e.stopImmediatePropagation();

                  return true;
                } else {
                  return false;
                }
              } else {
                return false;
              }
            } else {
              return false;
            }
          };

          _grabWorldTagMesh();
        };
        input.on('gripdown', _gripdown, {
          priority: -1,
        });
        const _gripup = e => {
          const {side} = e;
          const isOpen = rend.isOpen();

          if (isOpen) {
            const grabMesh = grabManager.getMesh(side);

            if (grabMesh) {
              const tagMesh = grabMesh;
              const {position, rotation, scale} = _decomposeObjectMatrixWorld(tagMesh);

              const matrixArray = position.toArray().concat(rotation.toArray()).concat(scale.toArray());
              _moveTag('hand:' + side, 'world:' + JSON.stringify(matrixArray));

              const triggerState = triggerStates[side];
              const {triggered} = triggerState;
              if (triggered) {
                triggerState.triggered = false;
              }
            }
          }
        };
        input.on('gripup', _gripup, {
          priority: -1,
        });

        const _getTagIdSrc = id => {
          const _getWorldSrc = () => {
            if (elementManager.getTagMeshes().some(tagMesh => tagMesh.item.id === id)) {
              return 'world:' + id;
            } else if (npmTagMeshes.some(tagMesh => tagMesh.item.id === id)) {
              return 'npm:' + id;
            } else if (wallet.getAssetTagMeshes().some(tagMesh => tagMesh.item.id === id)) {
              return 'asset:' + id;
            } else {
              return null;
            }
          };
          const _getHandSrc = () => {
            const controllers = cyborg.getControllers();

            for (let i = 0; i < SIDES.length; i++) {
              const side = SIDES[i];
              const grabMesh = grabManager.getMesh(side);

              if (grabMesh && grabMesh.item.id === id) {
                return 'hand:' + side;
              }
            }
            return null;
          };

          return _getWorldSrc() || _getHandSrc() || null;
        };
        const _grabNpmTag = ({side, tagMesh}) => {
          const grabMesh = grabManager.getMesh(side);

          if (!grabMesh) {
            const item = _clone(tagMesh.item);
            item.id = _makeId();
            item.metadata.isStatic = false;
            _addTag(item, 'hand:' + side);
          }
        };
        tags.on('grabNpmTag', _grabNpmTag);
        const _grabWorldTag = ({side, tagMesh}) => {
          const grabMesh = grabManager.getMesh(side);

          if (!grabMesh) {
            const {item} = tagMesh;
            const {id} = item;

            _moveTag('world:' + id, 'hand:' + side);
          }
        };
        tags.on('grabWorldTag', _grabWorldTag);
        const _mutateAddModule = ({element}) => {
          const name = element.getAttribute('name');
          const itemSpec = {
            type: 'module',
            id: _makeId(),
            name: name,
            displayName: name,
            attributes: {},
            matrix: DEFAULT_MATRIX,
            metadata: {
              isStatic: false,
            },
          };
          _addTag(itemSpec, 'world');
        };
        tags.on('mutateAddModule', _mutateAddModule);
        const _mutateRemoveModule = ({id}) => {
          const src = _getTagIdSrc(id);

          _removeTag(src);
        };
        tags.on('mutateRemoveModule', _mutateRemoveModule);
        const _mutateAddEntity = ({element, tagName, attributes}) => {
          const itemSpec = {
            type: 'entity',
            id: _makeId(),
            name: 'Manual entity',
            displayName: 'Manual entity',
            version: '0.0.1',
            tagName: tagName,
            attributes: attributes,
            matrix: DEFAULT_MATRIX,
            metadata: {},
          };
          _addTag(itemSpec, 'world', {element});
        };
        tags.on('mutateAddEntity', _mutateAddEntity);
        const _mutateRemoveEntity = ({id}) => {
          const src = _getTagIdSrc(id);

          _removeTag(src);
        };
        tags.on('mutateRemoveEntity', _mutateRemoveEntity);
        const _mutateSetAttribute = ({id, name, value}) => {
          const src = _getTagIdSrc(id);

          _request('setTagAttribute', [localUserId, src, {name, value}], _warnError);
        };
        tags.on('mutateSetAttribute', _mutateSetAttribute);
        const _tagsAddTag = ({itemSpec, dst}) => {
          _addTag(itemSpec, dst);
        };
        tags.on('addTag', _tagsAddTag);
        const _tagsSetAttribute = ({id, name, value}) => {
          const src = _getTagIdSrc(id);

          _handleSetTagAttribute(localUserId, src, {name, value});
        };
        tags.on('setAttribute', _tagsSetAttribute);
        const _tagsRemove = ({id}) => {
          const src = _getTagIdSrc(id);

          _request('removeTag', [localUserId, src], _warnError);

          _handleRemoveTag(localUserId, src);
        };
        tags.on('remove', _tagsRemove);
        const _tagsOpen = ({id}) => {
          const src = _getTagIdSrc(id);

          _request('tagOpen', [localUserId, src], _warnError);

          _handleTagOpen(localUserId, src);
        };
        tags.on('open', _tagsOpen);
        const _tagsClose = ({id}) => {
          const src = _getTagIdSrc(id);

          _request('tagClose', [localUserId, src], _warnError);

          _handleTagClose(localUserId, src);
        };
        tags.on('close', _tagsClose);
        const _tagsOpenDetails = ({id, isStatic}) => {
          const src = _getTagIdSrc(id);

          if (!isStatic) {
            _request('tagOpenDetails', [localUserId, src], _warnError);
          }

          _handleTagOpenDetails(localUserId, src);
        };
        tags.on('openDetails', _tagsOpenDetails);
        const _tagsCloseDetails = ({id, isStatic}) => {
          const src = _getTagIdSrc(id);

          if (!isStatic) {
            _request('tagCloseDetails', [localUserId, src], _warnError);
          }

          _handleTagCloseDetails(localUserId, src);
        };
        tags.on('closeDetails', _tagsCloseDetails);
        const _tagsPlay = ({id}) => {
          const src = _getTagIdSrc(id);

          _request('tagPlay', [localUserId, src], _warnError);

          _handleTagPlay(localUserId, src);
        };
        tags.on('play', _tagsPlay);
        const _tagsPause = ({id}) => {
          const src = _getTagIdSrc(id);

          _request('tagPause', [localUserId, src], _warnError);

          _handleTagPause(localUserId, src);
        };
        tags.on('pause', _tagsPause);
        const _tagsSeek = ({id, value}) => {
          const src = _getTagIdSrc(id);

          _request('tagSeek', [localUserId, src, value], _warnError);

          _handleTagSeek(localUserId, src, value);
        };
        tags.on('seek', _tagsSeek);
        const _tagsSeekUpdate = ({id, value}) => {
          const src = _getTagIdSrc(id);

          _request('tagSeekUpdate', [localUserId, src, value], _warnError);
        };
        tags.on('seekUpdate', _tagsSeekUpdate);
        const _reinstallModule = ({id}) => {
          const tagMesh = elementManager.getTagMesh(id);
          const {item} = tagMesh;
          const {name, displayName} = item;

          _request('unloadModule', [localUserId, displayName], _warnError);
          _handleUnloadModule(localUserId, displayName);

          loader.removePlugin(name)
            .then(() => {
              _request('loadModule', [localUserId, name], _warnError);
              _handleLoadModule(localUserId, name);
            })
            .catch(err => {
              console.warn(err);
            });
        };
        tags.on('reinstallModule', _reinstallModule);
        const _loadTags = ({itemSpecs}) => {
          for (let i = 0; i < itemSpecs.length; i++) {
            const itemSpec = itemSpecs[i];

            _handleAddTag(localUserId, itemSpec, 'world');
          }
        };
        tags.on('loadTags', _loadTags);
        const _broadcast = detail => {
          _request('broadcast', [detail], _warnError);
        };
        tags.on('broadcast', _broadcast);

        const _download = ({id}) => {
          const a = document.createElement('a');
          a.href = fs.getFileUrl(id);
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };
        tags.on('download', _download);

        const _makeFileTagFromSpec = fileSpec => {
          const {
            id,
            name,
            mimeType,
            files,
          } = fileSpec;
          const itemSpec = {
            type: 'file',
            id,
            name,
            mimeType,
            matrix: _getInFrontOfCameraMatrix(),
          };
          _handleAddTag(localUserId, itemSpec, 'world');

          const elementTagMeshes = elementManager.getTagMeshes();
          const tempTagMesh = elementTagMeshes.find(tagMesh => tagMesh.item.id === id);
          if (!rend.isOpen()) {
            tempTagMesh.visible = false;
          }
          const {item: tempItem} = tempTagMesh;
          tempItem.instancing = true;
          tempItem.temp = true;

          const _cleanupTempTagMesh = () => {
            elementManager.remove(tempTagMesh);

            tags.destroyTag(tempTagMesh);
          };

          return fs.writeFiles(id, files)
            .then(() => {
              _cleanupTempTagMesh();

              _addTag(itemSpec, 'world');

              const elementTagMeshes = elementManager.getTagMeshes();
              const tagMesh = elementTagMeshes.find(tagMesh => tagMesh.item.id === id);
              if (!rend.isOpen()) {
                tagMesh.visible = false;
              }

              return Promise.resolve(tagMesh);
            })
            .catch(err => {
              _cleanupTempTagMesh();

              return Promise.reject(err);
            });
        };
        const _upload = files => {
          const _makeFileTagFromFiles = files => {
            const id = _makeFileId();
            const mainFile = (() => {
              const _isRoot = f => /^\/[^\/]+/.test(f.path);
              const _getFileMode = f => {
                const {type: autoMimeType} = f;

                if (autoMimeType) {
                  return fs.getFileMode(autoMimeType);
                } else {
                  const match = f.path.match(/\.([^\/]+)$/);

                  if (match) {
                    const ext = match[1];
                    const fakeMimeType = 'mime/' + ext.toLowerCase();

                    return fs.getFileMode(fakeMimeType);
                  } else {
                    return null;
                  }
                }
              };
              const _isRecognizedMimeType = f => _getFileMode(f) !== null;
              const _isModelMimeType = f => _getFileMode(f) === 'model';

              return files.sort((a, b) => a.path.localeCompare(b.path))
                .sort((a, b) => {
                  const isRootDiff = +_isRoot(b) - +_isRoot(a);

                  if (isRootDiff !== 0) {
                    return isRootDiff;
                  } else {
                    const isRecognizedMimeTypeDiff = +_isRecognizedMimeType(b) - +_isRecognizedMimeType(a);

                    if (isRecognizedMimeTypeDiff !== 0) {
                      return isRecognizedMimeTypeDiff;
                    } else {
                      return _isModelMimeType(b) - +_isModelMimeType(a);
                    }
                  }
                })[0];
              })();
            const {path: name} = mainFile;
            const mimeType = (() => {
              const {type: mimeType} = mainFile;

              if (mimeType) {
                return mimeType;
              } else {
                const match = name.match(/\.([^.]+)$/);

                if (match) {
                  const ext = match[1];

                  return 'mime/' + ext.toLowerCase();
                } else {
                  return 'mime/blank';
                }
              }
            })();

            return _makeFileTagFromSpec({
              id,
              name,
              mimeType,
              files,
            });
          };
          _makeFileTagFromFiles(files)
            .then(tagMesh => {
              console.log('upoaded file', tagMesh);
            })
            .catch(err => {
              console.warn(err);
            });
        };
        fs.on('upload', _upload);

        const connection = (() => {
          if (serverEnabled) {
            const connection = new AutoWs(_relativeWsUrl('archae/worldWs?id=' + localUserId));
            let initialized = false;
            connection.on('message', msg => {
              const m = JSON.parse(msg.data);
              const {type} = m;

              if (type === 'init') {
                if (!initialized) { // XXX temporary hack until we correctly unload tags on disconnect
                  const {args: [itemSpecs]} = m;

                  tags.loadTags(itemSpecs);

                  initialized = true;
                }
              } else if (type === 'addTag') {
                const {args: [userId, itemSpec, dst]} = m;

                _handleAddTag(userId, itemSpec, dst);
              } else if (type === 'removeTag') {
                const {args: [userId, src]} = m;

                _handleRemoveTag(userId, src);
              } else if (type === 'moveTag') {
                const {args: [userId, src, dst]} = m;

                _handleMoveTag(userId, src, dst);
              } else if (type === 'setTagAttribute') {
                const {args: [userId, src, {name, value}]} = m;

                const tagMesh = _handleSetTagAttribute(userId, src, {name, value});

                // this prevents this mutation from triggering an infinite recursion multiplayer update
                // we simply ignore this mutation during the next entity mutation tick
                if (tagMesh) {
                  const {item} = tagMesh;
                  const {id} = item;

                  tags.ignoreEntityMutation({
                    type: 'setAttribute',
                    args: [id, name, value],
                  });
                }
              } else if (type === 'tagOpen') {
                const {args: [userId, src]} = m;

                _handleTagOpen(userId, src);
              } else if (type === 'tagClose') {
                const {args: [userId, src]} = m;

                _handleTagClose(userId, src);
              } else if (type === 'tagOpenDetails') {
                const {args: [userId, src]} = m;

                _handleTagOpenDetails(userId, src);
              } else if (type === 'tagCloseDetails') {
                const {args: [userId, src]} = m;

                _handleTagCloseDetails(userId, src);
              } else if (type === 'tagPlay') {
                const {args: [userId, src]} = m;

                _handleTagPlay(userId, src);
              } else if (type === 'tagPause') {
                const {args: [userId, src]} = m;

                _handleTagPause(userId, src);
              } else if (type === 'tagSeek') {
                const {args: [userId, src, value]} = m;

                _handleTagSeek(userId, src, value);
              } else if (type === 'loadModule') {
                const {args: [userId, plugin]} = m;

                _handleLoadModule(userId, plugin);
              } else if (type === 'unloadModule') {
                const {args: [userId, pluginName]} = m;

                _handleUnloadModule(userId, pluginName);
              } else if (type === 'message') {
                const {args: [detail]} = m;

                _handleMessage(detail);
              } else if (type === 'response') {
                const {id} = m;

                const requestHandler = requestHandlers.get(id);
                if (requestHandler) {
                  const {error, result} = m;
                  requestHandler(error, result);
                } else {
                  console.warn('unregistered handler:', JSON.stringify(id));
                }
              } else {
                console.log('unknown message', m);
              }
            });
            return connection;
          } else {
            return null;
          }
        })();

        if (homeEnabled) {
          tags.loadTags(defaultTags);
        }

        cleanups.push(() => {
          remoteGrabManager.destroy();

          rend.removeListener('update', _update);
          rend.removeListener('tabchange', _tabchange);

          input.removeListener('trigger', _trigger);
          input.removeListener('triggerdown', _triggerdown);
          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);

          tags.removeListener('download', _download);
          tags.removeListener('grabNpmTag', _grabNpmTag);
          tags.removeListener('grabWorldTag', _grabWorldTag);
          tags.removeListener('mutateAddModule', _mutateAddModule);
          tags.removeListener('mutateRemoveModule', _mutateRemoveModule);
          tags.removeListener('mutateAddEntity', _mutateAddEntity);
          tags.removeListener('mutateRemoveEntity', _mutateRemoveEntity);
          tags.removeListener('mutateSetAttribute', _mutateSetAttribute);
          tags.removeListener('addTag', _tagsAddTag);
          tags.removeListener('setAttribute', _tagsSetAttribute);
          tags.removeListener('remove', _tagsRemove);
          tags.removeListener('open', _tagsOpen);
          tags.removeListener('close', _tagsClose);
          tags.removeListener('openDetails', _tagsOpenDetails);
          tags.removeListener('closeDetails', _tagsCloseDetails);
          tags.removeListener('play', _tagsPlay);
          tags.removeListener('pause', _tagsPause);
          tags.removeListener('seek', _tagsSeek);
          tags.removeListener('seekUpdate', _tagsSeekUpdate);
          tags.removeListener('loadTags', _loadTags);
          tags.removeListener('broadcast', _broadcast);

          fs.removeListener('upload', _upload);

          connection.destroy();
        });

        class WorldApi {
          makeFile({ext = 'txt'} = {}) {
            const id = _makeId();
            const name = id + '.' + ext;
            const mimeType = 'mime/' + ext.toLowerCase();
            const path = '/' + name;
            const file = new Blob([], {
              type: mimeType,
            });
            file.path = path;
            const files = [file];

            return _makeFileTagFromSpec({
              id,
              name,
              mimeType,
              files,
            }).then(tagMesh => {
              const {item} = tagMesh;
              const {id, name} = item;

              return fs.makeFile('fs/' + id + '/' + name);
            });
          }
        }
        const worldApi = new WorldApi();

        return worldApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));
const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};
const _makeId = () => Math.random().toString(36).substring(7);
const _padNumber = (n, width) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};
const _makeFileId = () => {
  const array = new Uint8Array(128 / 8);
  crypto.getRandomValues(array);
  return array.reduce((acc, i) => {
    return acc + _padNumber(i.toString(16), 2);
  }, '');
};
const _warnError = err => {
  if (err) {
    console.warn(err);
  }
};

module.exports = World;
