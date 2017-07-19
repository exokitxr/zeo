const DEFAULT_USER_HEIGHT = 1.6;
const CAMERA_ROTATION_ORDER = 'YXZ';

class Three {
  mount() {
    const _requestThree = () => new Promise((accept, reject) => {
      window.module = {};

      const script = document.createElement('script');
      script.src = 'archae/three/three.js';
      script.async = true;
      script.onload = () => {
        const {exports: THREE} = window.module;
        window.module = {};

        accept(THREE);

        _cleanup();
      };
      script.onerror = err => {
        reject(err);

        _cleanup();
      };
      document.body.appendChild(script);

      const _cleanup = () => {
        document.body.removeChild(script);
      };
    });

    return _requestThree()
      .then(THREE => {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xFFFFFF);
        scene.autoUpdate = false;
        scene.fog = new THREE.FogExp2(0xFFFFFF, 0);

        const camera = (() => {
          const result = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 10 * 1024);
          result.position.x = 0;
          result.position.y = DEFAULT_USER_HEIGHT;
          result.position.z = 0;
          result.rotation.order = CAMERA_ROTATION_ORDER;
          result.up = new THREE.Vector3(0, 1, 0);
          result.name = 'left'; // for webvr updateEye()

          const target = new THREE.Vector3(0, DEFAULT_USER_HEIGHT, -1);
          result.lookAt(target);
          result.target = target;

          return result;
        })();
        const cameraParent = new THREE.Object3D();
        cameraParent.matrixAutoUpdate = false;
        cameraParent.add(camera);
        scene.add(cameraParent);

        const canvas = document.querySelector('#canvas');
        const renderer = new THREE.WebGLRenderer({
          canvas: canvas,
          antialias: true,
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.sortObjects = false;
        // renderer.shadowMap.enabled = true;
        // renderer.shadowMap.autoUpdate = false;
        // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        window.document.body.appendChild(renderer.domElement);

        window.addEventListener('resize', () => {
          if (!renderer.vr.enabled) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();

            renderer.setSize(window.innerWidth, window.innerHeight);
          }
        });

        return {
          THREE,
          scene,
          camera,
          renderer,
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Three;
