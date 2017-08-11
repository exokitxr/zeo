const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const cameraWidth = 0.2;
const cameraHeight = 0.15;
const cameraAspectRatio = cameraWidth / cameraHeight;
const cameraDepth = 0.1;

const dataSymbol = Symbol();

const camera = objectApi => {
  const {three, pose, input, render, items, utils: {sprite: spriteUtils}} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const localVector = new THREE.Vector3();
  const sourceCamera = new THREE.PerspectiveCamera(45, cameraWidth / cameraHeight, camera.near, camera.far);
  sourceCamera.name = camera.name;

  const _requestImage = src => new Promise((accept, reject) => {
    const img = new Image();
    img.onload = () => {
      accept(img);
    };
    img.onerror = err => {
      reject(img);
    };
    img.src = src;
  });
  const _requestImageBitmap = src => _requestImage(src)
    .then(img => createImageBitmap(img));

  return () => _requestImageBitmap('/archae/objects/img/camera.png')
    .then(cameraImg => {
      const cameraMaterial = (() => {
        const texture = new THREE.Texture(
          cameraImg,
          THREE.UVMapping,
          THREE.ClampToEdgeWrapping,
          THREE.ClampToEdgeWrapping,
          THREE.NearestFilter,
          THREE.NearestFilter,
          THREE.RGBAFormat,
          THREE.UnsignedByteType,
          1
        );
        texture.needsUpdate = true;
        const material = new THREE.MeshPhongMaterial({
          map: texture,
        });
        return material;
      })();

      const cameras = [];

      const cameraItemApi = {
        asset: 'ITEM.CAMERA',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              console.log('capture'); // XXX

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);

          const cameraMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(cameraWidth, cameraHeight, cameraDepth)
              /* .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                Math.PI / 2
              ))); */
            const uvs = geometry.getAttribute('uv').array;
            const numUvs = uvs.length / 2;
            for (let i = 0; i < numUvs; i++) {
              const index = i * 2 + 1;
              if (i >= 20 && i < (20 + 4)) {
                uvs[index] *= 0.5;
              } else {
                uvs[index] = 0.5 + uvs[index] / 2;
              }
            }

            const material = cameraMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;

            const renderTarget = (() => {
              const width = 1024;
              const height = width / cameraAspectRatio;
              const renderTarget = new THREE.WebGLRenderTarget(width, height, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                format: THREE.RGBAFormat,
              });
              return renderTarget;
            })();

            const screenMesh = (() => {
              const screenWidth = cameraWidth * 0.9;
              const screenHeight = cameraHeight * 0.9;
              const geometry = new THREE.PlaneBufferGeometry(screenWidth, screenHeight)
                .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, cameraDepth / 2));
              const material = new THREE.MeshBasicMaterial({
                map: renderTarget.texture,
              });
              const mesh = new THREE.Mesh(geometry, material);
              mesh.destroy = () => {
                geometry.dispose();
                material.dispose();
              };
              return mesh;
            })();
            mesh.add(screenMesh);

            mesh.update = () => {
              if (grabbable.isGrabbed()) {
                mesh.position.copy(grabbable.position);
                mesh.quaternion.copy(grabbable.rotation);
                // mesh.scale.copy(grabbable.scale);
                mesh.updateMatrixWorld();
                mesh.visible = true;

                sourceCamera.position.copy(mesh.position)
                  .add(
                    localVector.set(0, 0, -cameraDepth / 2)
                      .applyQuaternion(mesh.quaternion)
                  );
                sourceCamera.quaternion.copy(mesh.quaternion);

                renderer.render(scene, sourceCamera, renderTarget);
                renderer.setRenderTarget(null);
              } else {
                mesh.visible = false;
              }
            };
            mesh.destroy = () => {
              geometry.dispose();
              screenMesh.destroy();

              renderTarget.dispose();
            };

            return mesh;
          })();
          scene.add(cameraMesh);
          grabbable.cameraMesh = cameraMesh;

          cameras.push(grabbable);

          grabbable[dataSymbol] = {
            cleanup: () => {
              input.removeListener('triggerdown', _triggerdown);

              scene.remove(cameraMesh);
              cameraMesh.destroy();

              cameras.splice(cameras.indexOf(grabbable), 1);
            },
          };
        },
        itemRemovedCallback(grabbable) {
          const {[dataSymbol]: {cleanup}} = grabbable;
          cleanup();

          delete grabbable[dataSymbol];
        },
      };
      items.registerItem(this, cameraItemApi);

      const _update = () => {
        for (let i = 0; i < cameras.length; i++) {
          cameras[i].cameraMesh.update();
        }
      };
      render.on('update', _update);

      return () => {
        spriteUtils.releaseSpriteGeometry(sparkGeometrySpec);

        items.unregisterItem(this, cameraItemApi);
        render.removeListener('update', _update);
      };
    });
};

module.exports = camera;
