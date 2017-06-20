## `three` API

This API holds the [THREE.js](https://threejs.org) objects for the VR scene, including the `THREE` variable itself and the `Scene`, `Camera`, and `Renderer` objects.

We'll briefly discusss these here, but `THREE.js` is a large and powerful library. You'll want to [read the `THREE.js` documentation](https://threejs.org/docs/) for the full scoop.

#### `THREE`

This is the main `THREE` object. It's the same thing you'd get if you loaded THREE.js yourself. For performance, compatibility, and stability, you should always use this variable instead of loading your own copy of THREE.js.

```
const {THREE, scene} = zeo.three;
const mesh = new THREE.Mesh(
  new THREE.BoxBufferGeometry(1, 1, 1), // 1 meter sq
  new THREE.MeshPhongMaterial({
    color: 0x0000FF, // blue
  })
);
mesh.position.set(0, 1, -1); // 1 meter off the ground
scene.add(mesh);
```

#### `scene`, `camera`, `renderer`

These objects are pre-initialized VR scene instances of the corresponding THREE.js classes.

The `scene` is what is through `camera` via the `renderer`. These are all configured for you under the hood, so if you `scene.add()` something it should automatically appear in the VR world, the camera will correspond to the HMD, with the proper view of the world, and the renderer will have the correct parameters for the HMD.

You're free to use your own `THREE.js` objects on the side &mdash; sometimes this makes sense such as if you have a special type of rendering. But try to re-use the core objects if you can.

Few notes:

- If you `scene.add` (e.g. during your mod's `mount`), you must `scene.remove` (e.g. during your mod's `unmount`). Basically you need to follow the rules in the [Mods spec](/docs/mods-spec).
- The `camera` properties adjust automatically to the user's headset/screen. You can read them but _do not change them_. It won't work, and in VR you can't control the user's eyes anyway.
- Likewise, you can use the `renderer` to render stuff or read the parameters, but you shouldn't change them. Otherwise things will malfunction in weird ways and your module might get classified as broken.
