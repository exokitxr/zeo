function CakeModel({THREE}) {
  const object = new THREE.Object3D();

  const layerSpecs = [
    {
      color: 0x333333,
    },
    {
      color: 0xFFFFFF,
    },
    {
      color: 0x333333,
    },
    {
      color: 0xFFFFFF,
    },
    {
      color: 0x333333,
    },
  ];
  const layerSize = 0.2;
  const layerHeight = 0.03;

  const layersMesh = (() => {
    const object = new THREE.Object3D();

    for (let i = 0; i < layerSpecs.length; i++) {
      const layerSpec = layerSpecs[i];
      const {color} = layerSpec;
      
      const geometry = new THREE.CylinderBufferGeometry(layerSize, layerSize, layerHeight, 8, 1, false, 0, (Math.PI * 2) * (7 / 8));
      geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, (layerHeight * ((layerSpecs.length - 1) / 2)) - (i * layerHeight), 0));
      const material = new THREE.MeshPhongMaterial({
        color: color,
        side: THREE.DoubleSide,
      });

      const layerMesh = new THREE.Mesh(geometry, material);
      object.add(layerMesh);
    }

    return object;
  })();
  object.add(layersMesh);

  const numCherries = 8;
  const cherrySize = 0.02;
  const cherryRaidus = 0.125;

  const cherriesMesh = (() => {
    const object = new THREE.Object3D();

    const cherryMaterial = new THREE.MeshPhongMaterial({
      color: 0xE91E63,
      shininess: 0,
      shading: THREE.FlatShading,
    });

    for (let i = 0; i < numCherries; i++) {
      if (i === 0) {
        continue;
      }

      const geometry = new THREE.SphereBufferGeometry(cherrySize, 5, 5);
      const angle = (i / numCherries) * (Math.PI * 2);
      geometry.applyMatrix(new THREE.Matrix4().makeTranslation(
        Math.sin(angle) * cherryRaidus,
        (((layerSpecs.length - 1) / 2) * layerHeight) + (cherrySize * 1.5),
        Math.cos(angle) * cherryRaidus
      ));
      geometry.applyMatrix(new THREE.Matrix4().makeRotationY(-((1 / numCherries) * 0.5) * (Math.PI * 2)));
      const material = cherryMaterial;

      const cherryMesh = new THREE.Mesh(geometry, material);
      object.add(cherryMesh);
    }

    return object;
  })();
  object.add(cherriesMesh);

  return object;
}

module.exports = CakeModel;
