const width = 640;
const height = 480;

const dataSymbol = Symbol();

const map = objectApi => {
  const {three, pose, input, render, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const upVector = new THREE.Vector3(0, 1, 0);
  const forwardVector = new THREE.Vector3(0, 0, -1);
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localMatrix = new THREE.Matrix4();

  const sourceCamera = new THREE.PerspectiveCamera(45, 0.2 / 0.1, camera.near, camera.far);
  sourceCamera.name = camera.name;
  scene.add(sourceCamera);

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
    .then(img => createImageBitmap(img, 0, 0, img.width, img.height, {
      imageOrientation: 'flipY',
    }));

  return () => _requestImageBitmap('/archae/objects/img/plastic.png')
    .then(plasticImg => {
      const mapGeometry = new THREE.BoxBufferGeometry(0.1, 0.2, 0.01)
      const mapMaterial = (() => {
        const texture = new THREE.Texture(
          plasticImg,
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
        const material = new THREE.MeshBasicMaterial({
          map: texture,
        });
        return material;
      })();
      const _makeMapMesh = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const imageData = ctx.getImageData(0, 0, width, height);
        const buffer = new Uint8Array(imageData.data.buffer, imageData.data.buffer.byteOffset, width * height * 4);

        const _makeRenderTarget = () => new THREE.WebGLRenderTarget(width, height, {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          format: THREE.RGBAFormat,
        });
        const renderTargets = [
          _makeRenderTarget(),
          _makeRenderTarget(),
        ];

        const geometry = mapGeometry;

        const material = mapMaterial;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;

        const screenMesh = (() => {
          const geometry = new THREE.PlaneBufferGeometry(0.1, 0.2)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0.005));
          const material = new THREE.MeshBasicMaterial({
            // map: renderTarget.texture,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.destroy = () => {
            geometry.dispose();
            material.dispose();
          };
          return mesh;
        })();
        mesh.add(screenMesh);

        mesh.canvas = canvas;

        let grabbable = null;
        mesh.setGrabbable = newGrabbable => {
          grabbable = newGrabbable;
        };

        let frame = 0;
        mesh.update = (position, rotation) => {
          mesh.position.copy(position);
          mesh.quaternion.copy(rotation);
          // mesh.scale.copy(grabbable.scale);
          mesh.updateMatrixWorld();

          const renderTarget = renderTargets[frame];
          const nextFrame = (frame + 1) % 2;
          const nextRenderTarget = renderTargets[nextFrame];

          sourceCamera.position.copy(position);
          sourceCamera.position.y = 128;
          sourceCamera.quaternion.setFromRotationMatrix(
            localMatrix.lookAt(
              sourceCamera.position,
              position,
              localVector.copy(forwardVector).applyQuaternion(rotation)
            )
          );
          // sourceCamera.scale.copy(grabbable.scale);
          sourceCamera.updateMatrixWorld();

          const oldVrEnabled = renderer.vr.enabled;
          renderer.vr.enabled = false;
          mesh.visible = false;
          renderer.render(scene, sourceCamera, renderTarget);
          renderer.setRenderTarget(null);
          mesh.visible = true;
          renderer.vr.enabled = oldVrEnabled;

          screenMesh.material.map = nextRenderTarget.texture;
          // screenMesh.material.needsUpdate = true;
          renderer.readRenderTargetPixels(nextRenderTarget, 0, 0, width, height, buffer);
          ctx.putImageData(imageData, 0, 0);

          frame = nextFrame;
        };

        mesh.destroy = () => {
          renderTargets[0].dispose();
          renderTargets[1].dispose();
          screenMesh.destroy();
        };

        return mesh;
      };
      const mapMeshes = {
        left: _makeMapMesh(),
        right: _makeMapMesh(),
      };
      scene.add(mapMeshes.left);
      scene.add(mapMeshes.right);

      /* const cameraItemApi = {
        asset: 'ITEM.CAMERA',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              mapMeshes[side].canvas.toBlob(blob => {
                const dropMatrix = (() => {
                  const {hmd} = pose.getStatus();
                  const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmd;
                  localVector.copy(hmdPosition)
                    .add(
                      localVector2.copy(forwardVector).multiplyScalar(0.5)
                        .applyQuaternion(hmdRotation)
                    );
                  return localVector.toArray().concat(hmdRotation.toArray()).concat(hmdScale.toArray());
                })();
                items.makeFile({
                  data: blob,
                  matrix: dropMatrix,
                });
              }, {
                mimeType: 'image/png',
              });

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);

          grabbable.on('grab', e => {
            mapMeshes[e.side].setGrabbable(grabbable);

            grabbable.hide();
          });
          grabbable.on('release', e => {
            mapMeshes[e.side].setGrabbable(null);

            grabbable.show();
          });

          grabbable[dataSymbol] = {
            cleanup: () => {
              input.removeListener('triggerdown', _triggerdown);
            },
          };
        },
        itemRemovedCallback(grabbable) {
          const {[dataSymbol]: {cleanup}} = grabbable;
          cleanup();

          delete grabbable[dataSymbol];
        },
      };
      items.registerItem(this, cameraItemApi); */

      const _update = () => {
        const {gamepads} = pose.getStatus();
        const gamepad = gamepads.right;
        const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;

        // mapMeshes.left.update();
        mapMeshes.right.update(controllerPosition, controllerRotation);
      };
      render.on('update', _update);

      return () => {
        scene.remove(mapMeshes.left);
        mapMeshes.left.destroy();
        scene.remove(mapMeshes.right);
        mapMeshes.right.destroy();

        // items.unregisterItem(this, cameraItemApi);
        render.removeListener('update', _update);
      };
    });
};

module.exports = map;
