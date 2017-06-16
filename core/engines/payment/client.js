import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/payment';
import paymentRender from './lib/render/payment';

const ASSET_TAG_MESH_SCALE = 1.5;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const DEBUG = false;
// const DEBUG = true; // XXX
const SIDES = ['left', 'right'];

class Payment {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, home: {enabled: homeEnabled}, server: {enabled: serverEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/bootstrap',
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/tags',
      '/core/engines/wallet',
      '/core/utils/creature-utils',
    ]).then(([
      bootstrap,
      three,
      input,
      webvr,
      biolumi,
      rend,
      tags,
      wallet,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const paymentRenderer = paymentRender.makeRenderer({creatureUtils});
        const transparentMaterial = biolumi.getTransparentMaterial();

        /* const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        }; */

        const _resJson = res => {
          if (res.status >= 200 && res.status < 300) {
            return res.json();
          } else {
            return Promise.reject('API returned invalid status code: ' + res.status);
          }
        };

        const chargeMeshes = [];
        const _makeChargeMesh = ({srcAddress, dstAddress, srcAsset, srcQuantity, dstAsset, dstQuantity}, cb, cleanup) => {
          const id = _makeId();

          const object = new THREE.Object3D();

          const chargeState = {
            loading: true,
            hasAvailableBalance: false,
            paying: false,
            done: false,
          };

          const menuMesh = (() => {
            const paymentUi = biolumi.makeUi({
              width: WIDTH,
              height: HEIGHT,
            });
            const mesh = paymentUi.makePage(({
              pay: {
                loading,
                hasAvailableBalance,
                paying,
                done,
              },
            }) => {
              return {
                type: 'html',
                src: paymentRenderer.getChargePageSrc({id, dstAddress, srcAsset, srcQuantity, dstAsset, dstQuantity, loading, paying, done, hasAvailableBalance}),
                x: 0,
                y: 0,
                w: WIDTH,
                h: HEIGHT,
              };
            }, {
              type: 'charge',
              state: {
                pay: chargeState,
              },
              worldWidth: WORLD_WIDTH,
              worldHeight: WORLD_HEIGHT,
            });
            mesh.position.set(0, -0.5, -1);
            mesh.rotation.x = -Math.PI / 4;
            mesh.rotation.order = camera.rotation.order;

            return mesh;
          })();
          object.add(menuMesh);
          object.menuMesh = menuMesh;

          const {page} = menuMesh;
          page.initialUpdate();
          rend.addPage(page);

          _hasAvailableBalance(srcAsset, srcQuantity)
            .then(hasAvailableBalance => {
              chargeState.loading = false;
              chargeState.hasAvailableBalance = hasAvailableBalance;

              page.update();
            })
            .catch(err => {
              console.warn(err);

              chargeState.loading = false;
              chargeState.hasAvailableBalance = false;

              page.update();
            });

          const {hmd: hmdStatus} = webvr.getStatus();
          const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
          object.position.copy(hmdPosition);
          const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
          object.rotation.set(0, hmdEuler.y, 0, camera.rotation.order);

          object.paymentId = id;

          let live = true;
          object.confirm = () => {
            if (live) {
              const _ok = () => {
                chargeState.paying = false;
                chargeState.done = true;
                page.update();

                cb();

                setTimeout(() => {
                  cleanup();
                }, 2000);
              };

              if (!DEBUG) {
                fetch(`${siteUrl}/id/api/charge`, {
                  method: 'POST',
                  headers: (() => {
                    const headers = new Headers();
                    headers.append('Content-Type', 'application/json');
                    return headers;
                  })(),
                  body: JSON.stringify({
                    srcAddress,
                    dstAddress,
                    srcAsset,
                    srcQuantity,
                    dstAsset,
                    dstQuantity,
                  }),
                  credentials: 'include',
                })
                  .then(_resJson)
                  .then(() => {
                    _ok();
                  });

                chargeState.paying = true;
                page.update();
              } else {
                setTimeout(() => {
                  _ok();
                }, 2000);

                chargeState.paying = true;
                page.update();
              }

              live = false;
            }
          };
          object.cancel = () => {
            if (live) {
              const err = new Error('user canceled payment');
              cb(err);

              cleanup();

              live = false;
            }
          };

          object.destroy = () => {
            menuMesh.destroy();

            rend.removePage(page);
          };

          return object;
        };

        const _trigger = e => {
          const {side} = e;
          const hoverState = rend.getHoverState(side);
          const {intersectionPoint} = hoverState;

          if (intersectionPoint) {
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            let match;
            if (match = onclick.match(/^payment:charge:confirm:(.+)$/)) {
              const id = match[1];
              const chargeMesh = chargeMeshes.find(chargeMesh => chargeMesh.paymentId === id);

              chargeMesh.confirm();
            } else if (match = onclick.match(/^payment:charge:cancel:(.+)$/)) {
              const id = match[1];
              const chargeMesh = chargeMeshes.find(chargeMesh => chargeMesh.paymentId === id);

              chargeMesh.cancel();
            }
          }
        };
        input.on('trigger', _trigger, {
          priority: 1,
        });

        const _update = () => {
          const {hmd: hmdStatus} = webvr.getStatus();
          const {worldPosition: hmdPosition} = hmdStatus;

          const oldPaymentMeshes = chargeMeshes.slice();
          for (let i = 0; i < oldPaymentMeshes.length; i++) {
            const chargeMesh = oldPaymentMeshes[i];

            if (chargeMesh.position.distanceTo(hmdPosition) >= 1) {
              scene.remove(chargeMesh);
              chargeMesh.destroy();

              chargeMeshes.splice(chargeMeshes.indexOf(chargeMesh), 1);
            }
          }
        };
        rend.on('update', _update);

        this._cleanup = () => {
          for (let i = 0; i < chargeMeshes.length; i++) {
            const chargeMesh = chargeMeshes[i];
            scene.remove(chargeMesh);
            chargeMesh.destroy();

            chargeMeshes.splice(chargeMeshes.indexOf(chargeMesh), 1);
          }

          input.removeListener('trigger', _trigger);
          rend.removeListener('update', _update);
        };

        const _requestBalances = () => wallet.requestAssets();
        const _hasAvailableBalance = (asset, quantity) => {
          if (!DEBUG) {
            return wallet.requestAssets()
              .then(assets => {
                const assetSpec = assets.find(assetSpec => assetSpec.asset === asset);
                return Boolean(assetSpec) && assetSpec.quantity >= quantity;
              });
          } else {
            return Promise.resolve(true);
          }
        };
        const _requestCharge = ({
          srcAddress = bootstrap.getAddress(),
          dstAddress,
          srcAsset,
          srcQuantity,
          dstAsset = null,
          dstQuantity = 0,
          // message,
        }) => new Promise((accept, reject) => {
          const chargeMesh = _makeChargeMesh({
            srcAddress,
            dstAddress,
            srcAsset,
            srcQuantity,
            dstAsset,
            dstQuantity,
            // message,
          }, (err, result) => {
            if (!err) {
              accept(result);
            } else {
              reject(err);
            }
          }, () => {
            scene.remove(chargeMesh);
            chargeMesh.destroy();

            chargeMeshes.splice(chargeMeshes.indexOf(chargeMesh), 1);
          });
          scene.add(chargeMesh);
          chargeMesh.updateMatrixWorld();

          rend.reindex();
          rend.updateMatrixWorld(chargeMesh);

          chargeMeshes.push(chargeMesh)
        });

        return {
          requestBalances: _requestBalances,
          requestCharge: _requestCharge,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Payment;
