## API overview

Every module automatically has access to the `zeo` global variable, in both the browser and on the server. This `zeo` object has all of the APIs on it.

Once you [publish, load, and unload](/docs/mods-spec) your mods, you'll probably want to have your mods do stuff, and that's where this document comes in.

#### API sections

The APIs are grouped into several subkeys according to their function. Here's the list:

- `three`: the [THREE.js](https://threejs.org/) interface for the browser renderer, scene, camera, and so on
- `pose`: for querying the user's state, such as HMD and controller state
- `input`: handles input state checking (such as buttons) and emits input events (such as button presses)
- `render`: handles timing for rendering and emits events when interesting things happen (such as it's time for a frame)
- `entity`: handles registration and configuration of entities presented to the user
- `player`: handles multiplayer stuff, such as querying player states and enter/leave events
- `ui`: provides utilities for user interface rendering, such as menus
- `sound`: provides positional audio support
- `intersect`: provides advanced, GPU-accellerated intersection testing support
- `teleport`: lets you hook in to the teleport system by adding and removing surfaces
- `payment`: provides a set of APIs you can use to interact with user's VRID, such as asset ownership and charges

These APIs are accessible anywhere from your module:

```
// ...
function deepInsideMyModule() {
  if (zeo.three.camera.position.length() < 2) { // if camera is close to the origin
    doSomething();
  }
}
// ...
```

We go into each of these APIs in depth below.

#### `three`


