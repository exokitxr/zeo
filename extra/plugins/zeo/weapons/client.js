const MINIMAP_SIZE = 256;
const MINIMAP_RANGE = 200;

class Weapons {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return Promise.all([
      archae.requestEngines([
        '/core/engines/zeo',
      ]),
      archae.requestPlugins([
        '/core/plugins/geometry-utils',
        '/core/plugins/text-utils',
        '/core/plugins/creature-utils',
      ]),
    ]).then(([
      [zeo],
      [geometryUtils, textUtils, creatureUtils],
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = zeo;

        const world = zeo.getCurrentWorld();
        return world.requestMods([
          '/extra/plugins/zeo/singleplayer'
        ])
          .then(([
            singleplayer,
          ]) => {
            if (live) {
              const {physics} = world;
              const controllers = singleplayer.getControllers();

              const HUD_SOLID_MATERIAL = new THREE.MeshBasicMaterial({
                color: 0xFFFFFFF,
                side: THREE.DoubleSide,
                opacity: 0.8,
                transparent: true,
              });
              const HUD_WIREFRAME_MATERIAL = new THREE.MeshBasicMaterial({
                color: 0x333333,
                wireframe: true,
              });

              const ITEM_WIREFRAME_MATERIAL = new THREE.MeshBasicMaterial({
                color: 0x000000,
                wireframe: true,
                opacity: 0.25,
                transparent: true,
              });
              const ITEM_LINE_MATERIAL = new THREE.LineBasicMaterial({
                color: 0x000000,
                opacity: 0.25,
                transparent: true,
              });
              const ITEM_POINTS_MATERIAL = new THREE.PointsMaterial({
                color: 0xFFFFFF,
                size: 0.025,
              });

              const miniMapCamera = (() => {
                const camera = new THREE.OrthographicCamera(MINIMAP_RANGE / - 2, MINIMAP_RANGE / 2, MINIMAP_RANGE / - 2, MINIMAP_RANGE / 2, 0.1, 1024);

                // camera.position.x = 0;
                camera.position.y = -128;
                // camera.position.z = 0;

                camera.rotation.x = Math.PI / 2;

                return camera;
              })();
              const miniMapRenderTarget = new THREE.WebGLRenderTarget(MINIMAP_SIZE, MINIMAP_SIZE, {
                stencilBuffer: false,
                depthBuffer: false,
              });

              const keydown = e => {
                if (window.document.pointerLockElement) {
                  switch (e.keyCode) {
                    case 49: { // 1
                      const mode = singleplayer.getMode();
                      if (mode !== 'move') {
                        _setWeapon(mode, 'hud');
                      }
                      break;
                    }
                    case 50: { // 2
                      const mode = singleplayer.getMode();
                      if (mode !== 'move') {
                        _setWeapon(mode, 'sword');
                      }
                      break;
                    }
                    case 51: { // 3
                      const mode = singleplayer.getMode();
                      if (mode !== 'move') {
                        _setWeapon(mode, 'gun');
                      }
                      break;
                    }
                    case 52: { // 4
                      const mode = singleplayer.getMode();
                      if (mode !== 'move') {
                        _setWeapon(mode, 'clip');
                      }
                      break;
                    }
                    case 53: { // 5
                      const mode = singleplayer.getMode();
                      if (mode !== 'move') {
                        _setWeapon(mode, 'grenade');
                      }
                      break;
                    }
                  }
                }
              };
              window.addEventListener('keydown', keydown);

              const weaponMeshes = {
                left: null,
                right: null,
              };

              const _setWeapon = (side, weapon) => {
                const rootMesh = controllers[side].mesh;
                // const tipMesh = rootMesh.tip;

                const oldWeapon = weaponMeshes[side];
                if (oldWeapon) {
                  // rootMesh.remove(oldWeapon);
                  scene.remove(oldWeapon);

                  weaponMeshes[side] = null;
                }

                const newWeaponMesh = _makeWeaponMesh(weapon);
                // rootMesh.add(newWeaponMesh);
                scene.add(newWeaponMesh);

                weaponMeshes[side] = newWeaponMesh;
              };
              const _makeWeaponMesh = weaponType => {
                switch (weaponType) {
                  case 'hud': return _makeHudMesh();
                  case 'sword': return _makeSwordMesh();
                  case 'gun': return _makeGunMesh();
                  case 'clip': return _makeClipMesh();
                  case 'grenade': return _makeGrenadeMesh();
                  default: return null;
                }
              };
              const _makeHudMesh = () => {
                const result = new THREE.Object3D();
                result.weaponType = 'hud';

                const fullMesh = (() => {
                  const result = new THREE.Object3D();

                  const wireGeometry = new THREE.BoxBufferGeometry(0.1, 0.2, 0.01);
                  wireGeometry.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
                  const wireframeMesh = new THREE.Mesh(wireGeometry, HUD_WIREFRAME_MATERIAL);
                  result.add(wireframeMesh);

                  const solidGeometry = new THREE.PlaneBufferGeometry(0.1, 0.2, 1, 1);
                  solidGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0.01));
                  solidGeometry.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
                  const solidMesh = new THREE.Mesh(solidGeometry, HUD_SOLID_MATERIAL);
                  result.add(solidMesh);

                  return result;
                })();
                result.add(fullMesh);

                const upperLeftMesh = (() => {
                  const result = new THREE.Object3D();

                  const textMaterial = (() => {
                    const texture = (() => {
                      const img = (() => {
                        const worldName = textUtils.makePlanetName();

                        const width = 800;
                        const height = width / 4;

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;

                        const ctx = canvas.getContext('2d');

                        ctx.fillStyle = '#FF0000';
                        ctx.fillRect(0, 0, width, height / 10);

                        ctx.fillStyle = '#000000';
                        ctx.fillRect(0, height - (height / 20), width, height / 20);

                        ctx.font = '100px \'Titillium Web\'';
                        ctx.fillStyle = '#000000';
                        ctx.fillText(worldName, width / 50, height * 0.55);

                        ctx.font = '50px \'Titillium Web\'';
                        ctx.fillStyle = '#000000';
                        ctx.fillText('The best planet in the world.', width / 50, height * 0.85);

                        return canvas;
                      })();
                      const texture = new THREE.Texture(
                        img,
                        THREE.UVMapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.LinearFilter,
                        THREE.LinearFilter,
                        THREE.RGBAFormat,
                        THREE.UnsignedByteType,
                        16
                      );
                      texture.needsUpdate = true;
                      return texture;
                    })();
                    return new THREE.MeshBasicMaterial({
                      color: 0xFFFFFFF,
                      map: texture,
                      side: THREE.DoubleSide,
                      // opacity: 0.5,
                      transparent: true,
                    });
                  })();

                  const textGeometry = new THREE.PlaneBufferGeometry(0.1, 0.1 / 4, 2, 2);
                  textGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(-(0.1 / 2) + (0.1 / 2), (0.2 / 2) - ((0.1 / 4) / 2), 0.015));
                  textGeometry.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
                  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                  result.add(textMesh);

                  return result;
                })();
                result.add(upperLeftMesh);

                const upperRightMesh = (() => {
                  const result = new THREE.Object3D();

                  const frames = creatureUtils.makeCreature();

                  const _makeIconMaterial = img => {
                    const texture = (() => {
                      const texture = new THREE.Texture(
                        img,
                        THREE.UVMapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.NearestFilter,
                        THREE.NearestFilter,
                        THREE.RGBAFormat,
                        THREE.UnsignedByteType,
                        16
                      );
                      texture.needsUpdate = true;
                      return texture;
                    })();
                    return new THREE.MeshBasicMaterial({
                      color: 0xFFFFFFF,
                      map: texture,
                      side: THREE.DoubleSide,
                      // opacity: 0.5,
                      transparent: true,
                    });
                  };

                  const iconGeometry = new THREE.PlaneBufferGeometry(0.025, 0.025, 2, 2);
                  iconGeometry.applyMatrix(new THREE.Matrix4().makeTranslation((0.1 / 2) - (0.025 / 2), (0.2 / 2) - (0.025 / 2), 0.016));
                  iconGeometry.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));

                  const icon1Material = _makeIconMaterial(frames[0]);
                  const iconMesh1 = new THREE.Mesh(iconGeometry, icon1Material);
                  result.add(iconMesh1);

                  const icon2Material = _makeIconMaterial(frames[1]);
                  const iconMesh2 = new THREE.Mesh(iconGeometry, icon2Material);
                  iconMesh2.visible = false;
                  result.add(iconMesh2);

                  result.iconMeshes = [ iconMesh1, iconMesh2 ];

                  return result;
                })();
                result.add(upperRightMesh);
                result.upperRightMesh = upperRightMesh;

                /* const lowerLeftMesh = (() => {
                  const result = new THREE.Object3D();

                  const wireGeometry = new THREE.PlaneBufferGeometry(0.025, 0.025, 2, 2);
                  wireGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(-(0.1 / 2) + (0.025 / 2), -(0.2 / 2) + (0.025 / 2), 0.015));
                  wireGeometry.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
                  const wireframeMesh = new THREE.Mesh(wireGeometry, HUD_WIREFRAME_MATERIAL);
                  result.add(wireframeMesh);

                  return result;
                })();
                result.add(lowerLeftMesh); */

                const lowerRightMesh = (() => {
                  const result = new THREE.Object3D();

                  const miniMapMaterial = (() => {
                    const texture = (() => {
                      const {texture} = miniMapRenderTarget;
                      // texture.needsUpdate = true;
                      return texture;
                    })();
                    return new THREE.MeshBasicMaterial({
                      // color: 0xFFFFFF,
                      map: texture,
                      side: THREE.DoubleSide,
                      // opacity: 0.75,
                      transparent: true,
                    });
                  })();

                  const solidGeometry = new THREE.PlaneBufferGeometry(0.1, 0.1, 1, 1);
                  solidGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -(0.1 / 2), 0.015));
                  solidGeometry.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
                  const solidMesh = new THREE.Mesh(solidGeometry, miniMapMaterial);
                  result.add(solidMesh);

                  return result;
                })();
                result.add(lowerRightMesh);
                result.lowerRightMesh = lowerRightMesh;

                const physicsBody = new physics.Compound({
                  children: [
                    {
                      type: 'box',
                      position: [0, 0.005, 0],
                      dimensions: [0.1, 0.02, 0.2],
                    }
                  ],
                  mass: 1,
                });
                physicsBody.deactivate();
                physicsBody.setObject(result);
                physics.add(physicsBody);
                result.physicsBody = physicsBody;

                return result;
              };
              const _makeSwordMesh = (() => {
                const geometry1 = new THREE.PlaneBufferGeometry(0.1, 0.9, 1, 9);
                geometry1.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
                geometry1.applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
                geometry1.applyMatrix(new THREE.Matrix4().makeTranslation(0, -(0.1 / 2), -(0.9 / 2)));

                const geometry2 = new THREE.BufferGeometry(0.1, 1, 1, 9);
                geometry2.addAttribute('position', new THREE.BufferAttribute(new Float32Array([
                  0, 0, -0.9,
                  0, 0, -1.0,
                  0, -0.1, -0.9,
                ]), 3));

                const geometry3 = new THREE.BufferGeometry().fromGeometry(new THREE.SphereGeometry(0.1, 3, 3));
                geometry3.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));
                geometry3.applyMatrix(new THREE.Matrix4().makeRotationZ(-(Math.PI / 4) + (Math.PI / 16)));
                geometry3.applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.04, 0));
                geometry3.computeVertexNormals();

                const rootGeometry = new THREE.Geometry();
                rootGeometry.vertices.push(new THREE.Vector3( 0, 0, 0 ));

                const tipGeometry = new THREE.Geometry();
                tipGeometry.vertices.push(new THREE.Vector3( 0, 0, 0 ));

                return () => {
                  const mesh = new THREE.Object3D();
                  mesh.weaponType = 'sword';

                  const mesh1 = new THREE.Line(geometry1, ITEM_LINE_MATERIAL);
                  mesh.add(mesh1);

                  const mesh2 = new THREE.Line(geometry2, ITEM_LINE_MATERIAL);
                  mesh.add(mesh2);

                  const mesh3 = new THREE.Mesh(geometry3, ITEM_WIREFRAME_MATERIAL);
                  mesh.add(mesh3);

                  const rootMesh = new THREE.Points(rootGeometry, ITEM_POINTS_MATERIAL);
                  rootMesh.visible = false;
                  mesh.add(rootMesh);
                  mesh.rootMesh = rootMesh;

                  const tipMesh = new THREE.Points(tipGeometry, ITEM_POINTS_MATERIAL);
                  tipMesh.position.z = -1;
                  tipMesh.visible = false;
                  mesh1.add(tipMesh);
                  mesh.tipMesh = tipMesh;

                  const physicsBody = new physics.Compound({
                    children: [
                      {
                        type: 'box',
                        position: [0, -0.05, -0.45],
                        dimensions: [0.1, 0.1, 1.1],
                      }
                    ],
                    mass: 1,
                  });
                  physicsBody.deactivate();
                  physicsBody.setObject(mesh);
                  physics.add(physicsBody);
                  mesh.physicsBody = physicsBody;

                  return mesh;
                };
              })();

              const clipGeometry = (() => {
                const geometry1 = new THREE.BoxBufferGeometry(0.015, 0.175, 0.04);
                geometry1.applyMatrix(new THREE.Matrix4().makeTranslation(0, -(0.165 / 2) + (0.01 / 2), 0));
                geometry1.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.07, -0.01));
                geometry1.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));

                const geometry2 = new THREE.BoxBufferGeometry(0.03, 0.01, 0.05);
                geometry2.applyMatrix(new THREE.Matrix4().makeTranslation(0, -(0.165) - (0.01 / 2), 0));
                geometry2.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.07, -0.01));
                geometry2.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));

                const bulletGeometryTemplate = new THREE.BoxBufferGeometry(0.015 - 0.005, 0.01, 0.04 - 0.005);
                bulletGeometryTemplate.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.07, -0.01));

                const numBulletsTotal = 12;
                const bulletGeometries = (() => {
                  const result = [];
                  for (let i = 0; i < numBulletsTotal; i++) {
                    const bulletGeometry = bulletGeometryTemplate.clone();
                    bulletGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.015 * i, 0));
                    bulletGeometry.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));

                    result.push(bulletGeometry);
                  }
                  return result;
                })();
                const geometry = geometryUtils.concatBufferGeometry([
                  geometry1,
                  geometry2,
                ].concat(bulletGeometries));
                geometry.numBullets = numBulletsTotal;

                return geometry;
              })();
              // const clipPhysicsGeometry = new THREE.BoxGeometry(0.015, 0.175, 0.05);

              const _makeGunMesh = (function() {
                const geometry1 = new THREE.BoxBufferGeometry(0.04, 0.2, 0.04);
                geometry1.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.1, -0.005));
                geometry1.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2) - (Math.PI * 0.3)));

                const geometry2 = new THREE.BoxBufferGeometry(0.03, 0.165, 0.05);
                geometry2.applyMatrix(new THREE.Matrix4().makeTranslation(0, -(0.165 / 2), 0));
                geometry2.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.01));
                geometry2.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));

                const barrelGeometry = new THREE.Geometry();
                barrelGeometry.vertices.push(new THREE.Vector3( 0, 0, 0 ));

                const rootGeometry = new THREE.Geometry();
                rootGeometry.vertices.push(new THREE.Vector3( 0, 0, 0 ));

                const tipGeometry = new THREE.Geometry();
                tipGeometry.vertices.push(new THREE.Vector3( 0, 0, 0 ));

                return () => {
                  const mesh = new THREE.Object3D();
                  mesh.weaponType = 'gun';

                  const mesh1 = new THREE.Mesh(geometry1, ITEM_WIREFRAME_MATERIAL);
                  mesh.add(mesh1);

                  const mesh2 = new THREE.Mesh(geometry2, ITEM_WIREFRAME_MATERIAL);
                  mesh.add(mesh2);

                  const clipMesh = (() => {
                    const mesh = new THREE.Mesh(clipGeometry, ITEM_WIREFRAME_MATERIAL);
                    mesh.position.z = 0.07;

                    /* const physicsMesh = new Physijs.BoxMesh(clipPhysicsGeometry, ITEM_WIREFRAME_MATERIAL, weaponPhysicsMass, weaponPhysicsOptions);
                    mesh.physicsMesh = physicsMesh; */

                    return mesh;
                  })();
                  mesh.add(clipMesh);
                  mesh.clipMesh = clipMesh;

                  const barrelMesh = new THREE.Line(barrelGeometry, ITEM_POINTS_MATERIAL);
                  barrelMesh.rotation.x = -(Math.PI * 0.3);
                  barrelMesh.visible = false;
                  mesh.add(barrelMesh);

                  const barrelTipMesh = new THREE.Points(barrelGeometry, ITEM_POINTS_MATERIAL);
                  barrelTipMesh.position.y = -0.005;
                  barrelTipMesh.position.z = -0.2;
                  barrelTipMesh.visible = false;
                  barrelMesh.add(barrelTipMesh);
                  mesh.barrelTipMesh = barrelTipMesh;

                  const rootMesh = new THREE.Points(rootGeometry, ITEM_POINTS_MATERIAL);
                  rootMesh.visible = false;
                  mesh.add(rootMesh);
                  mesh.rootMesh = rootMesh;

                  const tipMesh = new THREE.Points(tipGeometry, ITEM_POINTS_MATERIAL);
                  tipMesh.position.z = -1;
                  tipMesh.visible = false;
                  mesh.add(tipMesh);
                  mesh.tipMesh = tipMesh;

                  const physicsBody = new physics.Compound({
                    children: (() => {
                      const barrelEuler = new THREE.Euler(
                        -(Math.PI / 2) - (Math.PI * 0.3),
                        0,
                        0,
                        camera.rotation.order
                      );
                      const barrel = {
                        type: 'box',
                        position: new THREE.Vector3(0, 0.1, -0.005).applyEuler(barrelEuler).toArray(),
                        rotation: new THREE.Quaternion().setFromEuler(barrelEuler).toArray(),
                        dimensions: [0.04, 0.2, 0.04],
                      };
                      const gripEuler = new THREE.Euler(
                        -(Math.PI / 2),
                        0,
                        0,
                        camera.rotation.order
                      );
                      const grip = {
                        type: 'box',
                        position: new THREE.Vector3(0, -(0.165 / 2), 0)
                          .add(new THREE.Vector3(0, 0, -0.01))
                          .applyEuler(gripEuler)
                          .toArray(),
                        rotation: new THREE.Quaternion().setFromEuler(gripEuler).toArray(),
                        dimensions: [0.03, 0.165, 0.05],
                      };

                      return [
                        barrel,
                        grip,
                      ];
                    })(),
                    mass: 1,
                  });
                  physicsBody.deactivate();
                  physicsBody.setObject(mesh);
                  physics.add(physicsBody);
                  mesh.physicsBody = physicsBody;

                  return mesh;
                };
              })();
              const _makeClipMesh = () => {
                const mesh = new THREE.Object3D();
                mesh.weaponType = 'clip';

                const clipMesh = new THREE.Mesh(clipGeometry, ITEM_WIREFRAME_MATERIAL);
                mesh.add(clipMesh);

                const physicsBody = new physics.Compound({
                  children: (() => {
                    const clipEuler = new THREE.Euler(
                      -(Math.PI / 2),
                      0,
                      0,
                      camera.rotation.order
                    );

                    return [
                      {
                        type: 'box',
                        position: new THREE.Vector3(0, -(0.165 / 2) + (0.01 / 2), 0)
                          .add(new THREE.Vector3(0, 0.065, -0.01))
                          .applyEuler(clipEuler)
                          .toArray(),
                        rotation: new THREE.Quaternion().setFromEuler(clipEuler).toArray(),
                        dimensions: [0.03, 0.185, 0.05]
                      }
                    ];
                  })(),
                  mass: 1,
                });
                physicsBody.deactivate();
                physicsBody.setObject(mesh);
                physics.add(physicsBody);
                mesh.physicsBody = physicsBody;

                return mesh;
              };
              const _makeGrenadeMesh = (() => {
                const geometry1 = new THREE.CylinderBufferGeometry(0.03, 0.03, 0.125, 6, 1);
                geometry1.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.03));
                geometry1.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));

                const geometry2 = new THREE.BoxBufferGeometry(0.03, 0.015, 0.03);
                geometry2.applyMatrix(new THREE.Matrix4().makeTranslation(0, (0.125 / 2) + (0.015 / 2), 0));
                geometry2.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.03));
                geometry2.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));

                const geometry3 = (() => {
                  const geometry1 = new THREE.BoxBufferGeometry(0.05, 0.005, 0.015);
                  geometry1.applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI / 4));
                  geometry1.applyMatrix(new THREE.Matrix4().makeTranslation(-(0.05 / 2) - 0.005, (0.125 / 2) - 0.005, 0));
                  geometry1.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.03));
                  geometry1.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));

                  const geometry2 = new THREE.BoxBufferGeometry(0.005, 0.0825, 0.015);
                  geometry2.applyMatrix(new THREE.Matrix4().makeTranslation(-0.05 + (0.005 / 2), 0, 0));
                  geometry2.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.03));
                  geometry2.applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)));

                  const geometry3 = geometryUtils.mergeBufferGeometry(geometry1, geometry2);
                  return geometry3;
                })();

                return () => {
                  const mesh = new THREE.Object3D();
                  mesh.weaponType = 'grenade';

                  const mesh1 = new THREE.Mesh(geometry1, ITEM_WIREFRAME_MATERIAL);
                  mesh.add(mesh1);

                  const mesh2 = new THREE.Mesh(geometry2, ITEM_WIREFRAME_MATERIAL);
                  mesh.add(mesh2);

                  const mesh3 = new THREE.Mesh(geometry3, ITEM_WIREFRAME_MATERIAL);
                  mesh.add(mesh3);

                  /* const physicsMesh = (() => {
                    const geometry = new THREE.BoxGeometry(0.03, 0.125, 0.03);
                    const mesh = new Physijs.BoxMesh(geometry, ITEM_WIREFRAME_MATERIAL, weaponPhysicsMass, weaponPhysicsOptions);
                    return mesh;
                  })();
                  mesh.physicsMesh = physicsMesh; */

                  return mesh;
                };
              })();

              const _update = ({worldTime}) => {
                const hudWeaponMeshes = [weaponMeshes.left, weaponMeshes.right]
                  .filter(weaponMesh => weaponMesh && weaponMesh.weaponType === 'hud');

                const _updateWeaponMeshes = () => {
                  ['left', 'right'].forEach(side => {
                    const weaponMesh = weaponMeshes[side];

                    if (weaponMesh) {
                      const controller = controllers[side];
                      const {mesh: controllerMesh} = controller;

                      const controllerPosition = new THREE.Vector3();
                      const controllerRotation = new THREE.Quaternion();
                      const controllerScale = new THREE.Vector3();
                      controllerMesh.updateMatrixWorld();
                      controllerMesh.matrixWorld.decompose(controllerPosition, controllerRotation, controllerScale);

                      weaponMesh.position.copy(controllerPosition);
                      weaponMesh.quaternion.copy(controllerRotation);

                      const {physicsBody} = weaponMesh;
                      if (physicsBody) { // XXX all weapon meshes should have this eventually
                         physicsBody.sync();
                      }
                    }
                  });
                };
                const _updateHudMeshIcon = () => {
                  const frameIndex = Math.floor(worldTime / 200) % 2;

                  hudWeaponMeshes.forEach(weaponMesh => {
                    const {upperRightMesh: {iconMeshes}} = weaponMesh;

                    iconMeshes.forEach((iconMesh, i) => {
                      const {visible: oldVisible} = iconMesh;
                      const newVisible = i === frameIndex;
                      if (newVisible !== oldVisible) {
                        iconMesh.visible = newVisible;
                      }
                    });
                  });
                };
                const _updateMiniMap = () => {
                  hudWeaponMeshes.forEach(weaponMesh => {
                    weaponMesh.visible = false;
                  });

                  renderer.render(scene, miniMapCamera, miniMapRenderTarget);
                  renderer.setRenderTarget(null);

                  hudWeaponMeshes.forEach(weaponMesh => {
                    weaponMesh.visible = true;
                  });
                };

                _updateWeaponMeshes();
                _updateHudMeshIcon();
                _updateMiniMap();
              };

              this._cleanup = () => {
                window.removeEventListener('keydown', keydown);
              };

              return {
                update: _update,
              };
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Weapons;
