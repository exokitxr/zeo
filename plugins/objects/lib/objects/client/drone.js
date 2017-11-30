const GENERATOR_PLUGIN = 'generator';
const width = 1920;
const height = 1080;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const drone = objectApi => () => {
  const {three, pose, input, render, elements, items, world} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const upVector = new THREE.Vector3(0, 1, 0);
  const forwardVector = new THREE.Vector3(0, 0, -1);
  const oneVector = new THREE.Vector3(1, 1, 1);
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();
  const localMatrix = new THREE.Matrix4();

  const sourceCamera = new THREE.PerspectiveCamera(45, width / height, camera.near, camera.far);
  sourceCamera.name = camera.name;
  scene.add(sourceCamera);

  const updates = [];

  const _getWorldTime = (() => {
    let worldTimeOffset = 0;
    return () => {
      const worldTime = world.getWorldTime();
      const timeDiff = worldTime - worldTimeOffset;
      if (timeDiff > (60 * 1000)) {
        worldTimeOffset = Math.floor(worldTime / (60 * 1000)) * (60 * 1000);
      }
      return worldTime - worldTimeOffset;
    };
  })();

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

  const _makeDroneMesh = (position, rotation, scale) => {
    const initialPosition = position.clone();

    const object = new THREE.Object3D();
    object.position.copy(initialPosition);
    object.quaternion.copy(rotation);
    object.scale.copy(scale);
    object.updateMatrixWorld();

    const coreMesh = (() => {
      const geometry = coreGeometry;
      const material = coreMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      return mesh;
    })();
    object.add(coreMesh);
    // object.coreMesh = coreMesh;

    const eyeballMesh = (() => {
      const geometry = eyeGeometry;
      const material = eyeMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -0.1 + 0.015;
      mesh.rotation.y = Math.PI;
      mesh.rotation.order = camera.rotation.order;
      return mesh;
    })();
    object.add(eyeballMesh);
    // object.eyeballMesh = eyeballMesh;

    const pupilMesh = (() => {
      const geometry = pupilGeometry;
      const material = pupilMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -0.1 + 0.005;
      mesh.rotation.y = Math.PI;
      mesh.rotation.order = camera.rotation.order;
      return mesh;
    })();
    object.add(pupilMesh);
    // object.pupilMesh = pupilMesh;

    object.update = () => {
      const angle = ((_getWorldTime() / 20000) % 1) * Math.PI * 2;
      object.position.lerp(
        localVector.copy(initialPosition).add(
          localVector2.set(
            Math.sin(angle) * 30,
            12,
            -Math.cos(angle) * 30,
          )
        ),
        0.01
      );
      object.quaternion.setFromRotationMatrix(
        localMatrix.lookAt(
          object.position,
          initialPosition,
          upVector
        )
      );
      object.updateMatrixWorld();
    };

    object.destroy = () => {};

    return object;
  };
  const _makeScreenMesh = droneMesh => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const imageData = ctx.getImageData(0, 0, width, height);
    const buffer = new Uint8Array(imageData.data.buffer, imageData.data.buffer.byteOffset, width * height * 4);

    const mediaStream = canvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: 'video/webm',
      bitsPerSecond: 15000 * 1024,
    });
    const blobs = [];
    mediaRecorder.ondataavailable = e => {
      blobs.push(e.data);
    };

    const _makeRenderTarget = () => new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
    });
    const renderTargets = [
      _makeRenderTarget(),
      _makeRenderTarget(),
    ];

    const geometry = new THREE.PlaneBufferGeometry(2 * 0.9, 2 / width * height * 0.9)
      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0.05 + 0.01));
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    let frame = 0;
    mesh.update = () => {
      const renderTarget = renderTargets[frame];
      const nextFrame = (frame + 1) % 2;
      const nextRenderTarget = renderTargets[nextFrame];

      sourceCamera.position.copy(droneMesh.position);
      sourceCamera.quaternion.copy(droneMesh.quaternion);
      sourceCamera.updateMatrixWorld();

      const oldVrEnabled = renderer.vr.enabled;
      renderer.vr.enabled = false;
      mesh.visible = false;
      renderer.render(scene, sourceCamera, renderTarget);
      renderer.setRenderTarget(null);
      mesh.visible = true;
      renderer.vr.enabled = oldVrEnabled;

      mesh.material.map = nextRenderTarget.texture;
      renderer.readRenderTargetPixels(nextRenderTarget, 0, 0, width, height, buffer);
      createImageBitmap(imageData, {
        imageOrientation: 'flipY'
      })
        .then(imageBitmap => {
          ctx.drawImage(imageBitmap, 0, 0);
        });

      frame = nextFrame;
    };

    let recordInterval = null;
    mesh.startRecording = () => {
      elements.getEntitiesElement().querySelector(GENERATOR_PLUGIN).addFrustumUnculled();

      mediaRecorder.start();
      recordInterval = setInterval(() => {
        mediaRecorder.requestData();
      }, 1000);
    };
    mesh.stopRecording = () => {
      mediaRecorder.onstop = () => {
        elements.getEntitiesElement().querySelector(GENERATOR_PLUGIN).removeFrustumUnculled();

        if (blobs.length > 0) {
          const blob = new Blob(blobs);
          blobs.length = 0;

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
            name: `drone-${new Date().toISOString()}.webm`,
            data: blob,
            matrix: dropMatrix,
          });
        }
        mediaRecorder.onstop = null;
      };

      mediaRecorder.stop();
      clearInterval(recordInterval);
      recordInterval = null;
    };
    mesh.cancelRecording = () => {
      mediaRecorder.onstop = () => {
        blobs.length = 0;
        mediaRecorder.onstop = null;
      };

      mediaRecorder.stop();
      clearInterval(recordInterval);
      recordInterval = null;
    };

    mesh.destroy = () => {
      geometry.dispose();
      material.dispose();

      for (let i = 0; i < renderTargets.length; i++) {
        renderTargets[i].dispose();
      }

      if (recordInterval) {
        mesh.cancelRecording();
      }
    };

    mesh.position.copy(droneMesh.position);
    mesh.quaternion.copy(droneMesh.quaternion);
    mesh.scale.copy(droneMesh.scale);
    mesh.updateMatrixWorld();

    return mesh;
  };

  const screens = {};
  const drones = {};

  const droneItemApi = {
    asset: 'ITEM.DRONE',
    itemAddedCallback(grabbable) {
      const _triggerdown = e => {
        const {side} = e;

        if (grabbable.getGrabberSide() === side) {
          localVector.copy(grabbable.position);
          localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
          localEuler.x = 0;
          localEuler.z = 0;
          localQuaternion.setFromEuler(localEuler);
          objectApi.addObject('drone', localVector, localQuaternion);

          items.destroyItem(grabbable);

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
      grabbable[dataSymbol].cleanup();

      delete grabbable[dataSymbol];
    },
  };
  items.registerItem(this, droneItemApi);

  const droneObjectApi = {
    object: 'drone',
    addedCallback(id, position, rotation, value) {
      const drone = _makeDroneMesh(position, rotation, oneVector);
      scene.add(drone);
      drones[id] = drone;

      const screen = _makeScreenMesh(drone);
      scene.add(screen);
      screens[id] = screen;

      screen.startRecording();
    },
    triggerCallback(id, side, x, z, objectIndex) {
      const screen = screens[id];
      screen.stopRecording();

      objectApi.removeObject(x, z, objectIndex);
    },
    gripCallback(id, side, x, z, objectIndex) {
      const itemId = _makeId();
      const asset = 'ITEM.DRONE';
      const assetInstance = items.makeItem({
        type: 'asset',
        id: itemId,
        name: asset,
        displayName: asset,
        attributes: {
          type: {value: 'asset'},
          value: {value: asset},
          position: {value: DEFAULT_MATRIX},
          quantity: {value: 1},
          owner: {value: null},
          bindOwner: {value: null},
          physics: {value: false},
        },
      });
      assetInstance.grab(side);

      objectApi.removeObject(x, z, objectIndex);
    },
    removedCallback(id) {
      const screen = screens[id];
      scene.remove(screen);
      screen.destroy();
      screens[id] = null;

      const drone = drones[id];
      scene.remove(drone);
      drone.destroy();
      drones[id] = null;
    },
  };
  objectApi.registerObject(droneObjectApi);

  const _update = () => {
    for (const id in screens) {
      const screen = screens[id];
      if (screen) {
        screen.update();
      }
    }
    for (const id in drones) {
      const drone = drones[id];
      if (drone) {
        drone.update();
      }
    }
  };
  render.on('update', _update);

  return Promise.resolve(() => {
    items.unregisterItem(this, droneItemApi);
    objectApi.unregisterObject(droneObjectApi);

    render.removeListener('update', _update);
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = drone;
