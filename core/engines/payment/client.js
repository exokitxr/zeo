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

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/keyboard',
      '/core/engines/tags',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      rend,
      keyboard,
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
        const _makePaymentMesh = () => {
          const paymentUi = biolumi.makeUi({
            width: WIDTH,
            height: HEIGHT,
          });
          const mesh = paymentUi.makePage(({
            // nothing
          }) => {
            return {
              type: 'html',
              src: paymentRenderer.getPaymentSrc(),
              x: 0,
              y: 0,
              w: WIDTH,
              h: HEIGHT,
            };
          }, {
            type: 'payment',
            state: {
              // nothing
            },
            worldWidth: WORLD_WIDTH,
            worldHeight: WORLD_HEIGHT,
          });
          mesh.receiveShadow = true;

          const {page} = mesh;
          rend.addPage(page);

          mesh.destroy = (destroy => function() {
            destroy.apply(this, arguments);

            rend.removePage(page);
          })(mesh.destroy);

          return mesh;
        };

        const _trigger = e => {
          const {side} = e;
          const hoverState = rend.getHoverState(side);
          const {intersectionPoint} = hoverState;

          if (intersectionPoint) {
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            if (onclick === 'payment:confirm') {
              // XXX
            } else if (onclick === 'payment:cancel') {
              // XXX
            }
          }
        };
        input.on('trigger', _trigger, {
          priority: 1,
        });

        cleanups.push(() => {
          for (let i = 0; i < paymentMeshes.length; i++) {
            const paymentMesh = paymentMeshes[i];
            scene.remove(paymentMesh);
            paymentMesh.destroy();
          }
        });

        const _requestPayment = () => new Promise((accept, reject) => {
          const paymentMesh = _makePaymentMesh();
          paymentMeshes.push(paymentMesh);
        });

        return {
          requestPayment: _requestPayment,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Payment;
