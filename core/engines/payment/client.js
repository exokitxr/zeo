import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/payment';
import paymentRenderer from './lib/render/payment';

const ASSET_TAG_MESH_SCALE = 1.5;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

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
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/tags',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      rend,
      tags,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const transparentMaterial = biolumi.getTransparentMaterial();

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const paymentMeshes = [];
        const _makePayMesh = ({address, asset, quantity}, cb, cleanup) => {
          const id = _makeId();

          const object = new THREE.Object3D();

          const payState = {
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
                src: paymentRenderer.getPayPageSrc({id, address, loading, paying, done, hasAvailableBalance}),
                x: 0,
                y: 0,
                w: WIDTH,
                h: HEIGHT,
              };
            }, {
              type: 'pay',
              state: {
                pay: payState,
              },
              worldWidth: WORLD_WIDTH,
              worldHeight: WORLD_HEIGHT,
            });
            mesh.position.set(0, -0.5, -1);
            mesh.rotation.x = -Math.PI / 4;
            mesh.rotation.order = camera.rotation.order;

            const tagMesh = (() => {
              const mesh = tags.makeTag({
                type: 'asset',
                id: asset + ':fake',
                name: asset,
                displayName: asset,
                quantity: quantity,
                matrix: DEFAULT_MATRIX,
                metadata: {
                  isStatic: true,
                },
              });
              mesh.position.set(-WORLD_WIDTH * 0.28, 0, 0.001);
              mesh.visible = false;

              return mesh;
            })();
            mesh.add(tagMesh);
            mesh.tagMesh = tagMesh;

            return mesh;
          })();
          object.add(menuMesh);
          object.menuMesh = menuMesh;

          const {page} = menuMesh;
          page.initialUpdate();
          rend.addPage(page);

          _hasAvailableBalance(asset, quantity)
            .then(hasAvailableBalance => {
              payState.loading = false;
              payState.hasAvailableBalance = hasAvailableBalance;

              page.update();

              const {tagMesh} = menuMesh;
              tagMesh.visible = true;
            })
            .catch(err => {
              console.warn(err);

              payState.loading = false;
              payState.hasAvailableBalance = false;

              page.update();

              const {tagMesh} = menuMesh;
              tagMesh.visible = true;
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
              fetch(`${siteUrl}/wallet/api/pay`, {
                method: 'POST',
                headers: (() => {
                  const headers = new Headers();
                  headers.append('Content-Type', 'application/json');
                  return headers;
                })(),
                body: JSON.stringify({
                  address,
                  asset,
                  quantity,
                }),
                credentials: 'include',
              })
                .then(res => {
                  if (res.status >= 200 && res.status < 300) {
                    return res.json();
                  } else {
                    return null;
                  }
                })
                .then(() => {
                  payState.paying = false;
                  payState.done = true;
                  page.update();

                  const {tagMesh} = menuMesh;
                  tagMesh.visible = false;

                  cb();

                  setTimeout(() => {
                    cleanup();
                  }, 2000);
                });

              payState.paying = true;
              page.update();

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

            const {tagMesh} = menuMesh;
            tags.destroyTag(tagMesh);

            rend.removePage(page);
          };

          return object;
        };
        const _makeBuyMesh = ({srcAsset, srcQuantity, dstAsset, dstQuantity}, cb, cleanup) => {
          const id = _makeId();

          const object = new THREE.Object3D();

           const payState = {
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
                src: paymentRenderer.getBuyPageSrc({id, loading, hasAvailableBalance, paying, done}),
                x: 0,
                y: 0,
                w: WIDTH,
                h: HEIGHT,
              };
            }, {
              type: 'buy',
              state: {
                pay: payState,
              },
              worldWidth: WORLD_WIDTH,
              worldHeight: WORLD_HEIGHT,
            });
            mesh.position.set(0, -0.5, -1);
            mesh.rotation.x = -Math.PI / 4;
            mesh.rotation.order = camera.rotation.order;

            const dstTagMesh = (() => {
              const mesh = tags.makeTag({
                type: 'asset',
                id: id + ':dst',
                name: dstAsset,
                displayName: dstAsset,
                quantity: dstQuantity,
                matrix: DEFAULT_MATRIX,
                metadata: {
                  isStatic: true,
                },
              });
              mesh.position.set(-WORLD_WIDTH * 0.28, 0, 0.001);
              mesh.visible = false;

              return mesh;
            })();
            mesh.add(dstTagMesh);
            mesh.dstTagMesh = dstTagMesh;

            const srcTagMesh = (() => {
              const mesh = tags.makeTag({
                type: 'asset',
                id: id + ':src',
                name: srcAsset,
                displayName: srcAsset,
                quantity: srcQuantity,
                matrix: DEFAULT_MATRIX,
                metadata: {
                  isStatic: true,
                },
              });
              mesh.position.set(0, 0, 0.001);
              mesh.visible = false;

              return mesh;
            })();
            mesh.add(srcTagMesh);
            mesh.srcTagMesh = srcTagMesh;

            return mesh;
          })();
          object.add(menuMesh);
          object.menuMesh = menuMesh;

          const {page} = menuMesh;
          page.initialUpdate();
          rend.addPage(page);

          _hasAvailableBalance(srcAsset, srcQuantity)
            .then(hasAvailableBalance => {
              payState.loading = false;
              payState.hasAvailableBalance = hasAvailableBalance;

              page.update();

              const {srcTagMesh, dstTagMesh} = menuMesh;
              srcTagMesh.visible = true;
              dstTagMesh.visible = true;
            })
            .catch(err => {
              console.warn(err);

              payState.loading = false;
              payState.hasAvailableBalance = false;

              page.update();

              const {srcTagMesh, dstTagMesh} = menuMesh;
              srcTagMesh.visible = true;
              dstTagMesh.visible = true;
            });

          const {hmd: hmdStatus} = webvr.getStatus();
          const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
          object.position.copy(hmdPosition);
          const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
          object.rotation.set(0, hmdEuler.y, 0, camera.rotation.order);

          object.paymentId = id;
          object.confirm = () => {
            if (live) {
              setTimeout(() => {
                payState.paying = false;
                payState.done = true;
                page.update();

                const {dstTagMesh, srcTagMesh} = menuMesh;
                dstTagMesh.visible = false;
                srcTagMesh.visible = false;

                cb();

                setTimeout(() => {
                  cleanup();
                }, 2000);
              }, 2000);

              payState.paying = true;
              page.update();

              live = false;
            }
          };
          object.cancel = () => {
            const err = new Error('user canceled payment');
            cb(err);

            cleanup();
          };

          object.destroy = () => {
            menuMesh.destroy();

            const {dstTagMesh, srcTagMesh} = menuMesh;
            tags.destroyTag(dstTagMesh);
            tags.destroyTag(srcTagMesh);

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
            if (match = onclick.match(/^payment:(pay|buy):confirm:(.+)$/)) {
              const type = match[1];
              const id = match[2];
              const paymentMesh = paymentMeshes.find(paymentMesh => paymentMesh.paymentId === id);

              paymentMesh.confirm();
            } else if (match = onclick.match(/^payment:(pay|buy):cancel:(.+)$/)) {
              const type = match[1];
              const id = match[2];
              const paymentMesh = paymentMeshes.find(paymentMesh => paymentMesh.paymentId === id);

              paymentMesh.cancel();
            }
          }
        };
        input.on('trigger', _trigger, {
          priority: 1,
        });

        const _update = () => {
          const {hmd: hmdStatus} = webvr.getStatus();
          const {worldPosition: hmdPosition} = hmdStatus;

          const oldPaymentMeshes = paymentMeshes.slice();
          for (let i = 0; i < oldPaymentMeshes.length; i++) {
            const paymentMesh = oldPaymentMeshes[i];

            if (paymentMesh.position.distanceTo(hmdPosition) >= 1) {
              scene.remove(paymentMesh);
              paymentMesh.destroy();
              paymentMeshes.splice(paymentMeshes.indexOf(paymentMesh), 1);
            }
          }
        };
        rend.on('update', _update);

        this._cleanup = () => {
          for (let i = 0; i < paymentMeshes.length; i++) {
            const paymentMesh = paymentMeshes[i];
            scene.remove(paymentMesh);
            paymentMesh.destroy();
          }

          input.removeListener('trigger', _trigger);
          rend.removeListener('update', _update);
        };

        const _requestBalances = () => fetch(`${siteUrl}/wallet/api/status`, {
          credentials: 'include',
        })
          .then(res => res.json())
          .then(status => status.assets);
        const _hasAvailableBalance = (asset, quantity) => _requestBalances()
          .then(balances => {
            const balanceSpec = balances.find(balance => balance.asset === asset);
            return balanceSpec && balanceSpec.quantity >= quantity;
          });
        const _requestPay = ({address, asset, quantity, message}) => new Promise((accept, reject) => {
          const paymentMesh = _makePayMesh({
            address,
            asset,
            quantity,
            message,
          }, (err, result) => {
            if (!err) {
              accept(result);
            } else {
              reject(err);
            }
          }, () => {
            scene.remove(paymentMesh);
            paymentMesh.destroy();
          });

          scene.add(paymentMesh);
          paymentMeshes.push(paymentMesh)
        });
        const _requestBuy = ({srcAsset, srcQuantity, dstAsset, dstQuantity, message}) => new Promise((accept, reject) => {
          const paymentMesh = _makeBuyMesh({
            srcAsset,
            srcQuantity,
            dstAsset,
            dstQuantity,
            message,
          }, (err, result) => {
            if (!err) {
              accept(result);
            } else {
              reject(err);
            }
          }, () => {
            scene.remove(paymentMesh);
            paymentMesh.destroy();
          });

          scene.add(paymentMesh);
          paymentMeshes.push(paymentMesh);
        });

        return {
          requestBalances: _requestBalances,
          requestPay: _requestPay,
          requestBuy: _requestBuy,
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
