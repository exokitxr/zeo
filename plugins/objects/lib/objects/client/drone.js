const width = 640;
const height = 480;

const dataSymbol = Symbol();

const drone = objectApi => () => {
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
  
  /* const updates = [];

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
  })(); */

  const coreGeometry = new THREE.SphereBufferGeometry(0.1, 8, 6);
  const eyeGeometry = new THREE.CylinderBufferGeometry(0.05, 0.05, 0.015, 8, 1)
    .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  const pupilGeometry = new THREE.CylinderBufferGeometry(0.03, 0.03, 0.015, 8, 1)
    .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

  const coreMaterial = new THREE.MeshPhongMaterial({
    color: 0xCCCCCC,
    shading: THREE.FlatShading,
  });
  const eyeMaterial = new THREE.MeshPhongMaterial({
    color: 0xEEEEEE,
    shading: THREE.FlatShading,
  });
  const pupilMaterial = new THREE.MeshPhongMaterial({
    color: 0x111111,
    shading: THREE.FlatShading,
  });

  const _makeDroneMesh = position => {
    const object = new THREE.Object3D();
    object.position.copy(position);

    const coreMesh = (() => {
      const geometry = coreGeometry;
      const material = coreMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      return mesh;
    })();
    object.add(coreMesh);
    object.coreMesh = coreMesh;

    const eyeballMesh = (() => {
      const geometry = eyeGeometry;
      const material = eyeMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = 0.1 - 0.015;
      mesh.rotation.y = Math.PI;
      mesh.rotation.order = camera.rotation.order;
      return mesh;
    })();
    object.add(eyeballMesh);
    object.eyeballMesh = eyeballMesh;

    const pupilMesh = (() => {
      const geometry = pupilGeometry;
      const material = pupilMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = 0.1 - 0.005;
      mesh.rotation.y = Math.PI;
      mesh.rotation.order = camera.rotation.order;
      return mesh;
    })();
    object.add(pupilMesh);
    object.pupilMesh = pupilMesh;

    /* const canvas = document.createElement('canvas');
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

    let frame = 0;
    const update = () => {
      mesh.position.copy(grabbable.position);
      mesh.quaternion.copy(grabbable.rotation);
      mesh.updateMatrixWorld();

      const renderTarget = renderTargets[frame];
      const nextFrame = (frame + 1) % 2;
      const nextRenderTarget = renderTargets[nextFrame];

      sourceCamera.position.copy(grabbable.position);
      sourceCamera.position.y = 128;
      sourceCamera.quaternion.setFromRotationMatrix(
        localMatrix.lookAt(
          sourceCamera.position,
          grabbable.position,
          localVector.copy(forwardVector).applyQuaternion(grabbable.rotation)
        )
      );
      sourceCamera.updateMatrixWorld();

      const oldVrEnabled = renderer.vr.enabled;
      renderer.vr.enabled = false;
      mesh.visible = false;
      renderer.render(scene, sourceCamera, renderTarget);
      renderer.setRenderTarget(null);
      mesh.visible = true;
      renderer.vr.enabled = oldVrEnabled;

      screenMesh.material.map = nextRenderTarget.texture;
      renderer.readRenderTargetPixels(nextRenderTarget, 0, 0, width, height, buffer);
      ctx.putImageData(imageData, 0, 0);

      frame = nextFrame;
    };
    updates.push(update); */

    object.destroy = () => {
      /* for (let i = 0; i < renderTargets.length; i++) {
        renderTargets[i].dispose();
      }
      screenMesh.destroy(); */
    };

    return object;
  };

  const drones = [];

  const droneItemApi = {
    asset: 'ITEM.DRONE',
    itemAddedCallback(grabbable) {
      const _triggerdown = e => {
        const {side} = e;

        if (grabbable.getGrabberSide() === side) {
          const drone = _makeDroneMesh(grabbable.position);
          scene.add(drone);
          drones.push(drone);

          items.destroyItem(grabbable);

          /* mapMeshes[side].canvas.toBlob(blob => {
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
          }); */

          e.stopImmediatePropagation();
        }
      };
      input.on('triggerdown', _triggerdown);

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
  items.registerItem(this, droneItemApi);

  const _update = () => {
    for (let i = 0; i < drones.length; i++) {
      const drone = drones[i];
      drone.position.y += 0.001;
      drone.updateMatrixWorld();
      // XXX
    }
  };
  render.on('update', _update);

  return Promise.resolve(() => {
    items.unregisterItem(this, droneItemApi);

    render.removeListener('update', _update);
  });
};

module.exports = drone;
