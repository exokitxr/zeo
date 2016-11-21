const TELEPORT_DISTANCE = 15;

class Teleport {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;

        const world = zeo.getCurrentWorld();
        return world.requestMods([
          '/extra/plugins/zeo/controllers'
        ])
          .then(([
            controllers,
          ]) => {
            const controllerMeshes = controllers.getControllerMeshes();

            const mesh = (() => {
              const geometry = new THREE.TorusBufferGeometry(0.5, 0.1, 3, 5, Math.PI * 2);
              geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
              geometry.applyMatrix(new THREE.Matrix4().makeRotationY((1 / 20) * (Math.PI * 2)));

              const material = new THREE.MeshBasicMaterial({
                color: 0x000000,
                wireframe: true,
                opacity: 0.25,
                transparent: true,
              });

              const mesh = new THREE.Mesh(geometry, material);
              mesh.visible = false;

              return mesh;
            })();
            scene.add(mesh);

            const floorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));

            let side = null;
            let teleporting = false;
            let commitTeleporting = false;
            let teleportPoint = null;
            const keydown = e => {
              if (window.document.pointerLockElement) {
                switch (e.keyCode) {
                  case 90: // Z
                    side = 'left';
                    break;
                  case 88: // X
                    side = null;
                    teleporting = false;
                    commitTeleporting = false;
                    teleportPoint = null;
                    break;
                  case 67: // C
                    side = 'right';
                    break;
                  case 32: // space
                    if (side !== null) {
                      teleporting = true;
                    }
                    break;
                }
              }
            };
            const keyup = e => {
              if (window.document.pointerLockElement) {
                switch (e.keyCode) {
                  case 32: // space
                    teleporting = false;
                    commitTeleporting = true;
                    break;
                }
              }
            };
            window.addEventListener('keydown', keydown);
            window.addEventListener('keyup', keyup);

            this._cleanup = () => {
              window.removeEventListener('keydown', keydown);
              window.removeEventListener('keyup', keyup);
            };

            const _getMatrixWorld = mesh => {
              const position = new THREE.Vector3();
              const quaternion = new THREE.Quaternion();
              const scale = new THREE.Vector3();

              mesh.matrixWorld.decompose(position, quaternion, scale);

              return {
                position,
                quaternion,
                scale,
              };
            };

            const _update = options => {
              if (teleporting) {
                const rootMesh = controllerMeshes[side].mesh.inner;
                const tipMesh = rootMesh.tip;

                const rootMatrixWorld = _getMatrixWorld(rootMesh);
                const tipMatrixWorld = _getMatrixWorld(tipMesh);
                const ray = tipMatrixWorld.position.clone().sub(rootMatrixWorld.position);
                const controllerLine = new THREE.Line3(
                  rootMatrixWorld.position.clone(),
                  rootMatrixWorld.position.clone().add(ray.clone().multiplyScalar(TELEPORT_DISTANCE))
                );
                const intersectionPoint = floorPlane.intersectLine(controllerLine);

                if (intersectionPoint) {
                  mesh.position.copy(intersectionPoint);

                  const rootMatrixWorldEuler = new THREE.Euler().setFromQuaternion(rootMatrixWorld.quaternion, camera.rotation.order);
                  mesh.rotation.y = rootMatrixWorldEuler.y;

                  teleportPoint = intersectionPoint;

                  if (!mesh.visible) {
                    mesh.visible = true;
                  }
                } else {
                  teleportPoint = null;

                  if (mesh.visible) {
                    mesh.visible = false;
                  }
                }
              } else if (commitTeleporting) {
                if (teleportPoint) {
                  camera.position.set(teleportPoint.x, teleportPoint.y + 1.5, teleportPoint.z);

                  teleportPoint = null;
                }

                commitTeleporting = false;

                if (mesh.visible) {
                  mesh.visible = false;
                }

                // update the controllers immediately instead of waiting for the next frame
                controllers.update(options);
              }
            };

            return {
              update: _update,
            };
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Teleport;
