# [zeo.sh](https://zeo.sh)

WebVR worlds in Javascript.

Zeo.sh lets you run `npm` modules in VR from your browser, using a headset or keyboard + mouse. The goal is _Javascript from fingers to face at the speed of thought_.

<img src="https://cdn.rawgit.com/modulesio/zeo-data/defb101e115250f6512ab6f6c29e69ce9e75a80b/video/demo.gif" width="512px">

If you know how to run `node`, you can pick up your headset + controllers and build worlds out of Zeo modules on `npm`. If you know Javascript, `THREE.js`, and `npm`, then you can write your own.

## Features

- One command `npm install`
- WebVR-based and polyfilled for older browsers
- World persistence
- [NPM](https://npmjs.org) ecosystem access from VR
- In-VR module configurator
- Multiplayer with voice chat
- Server-side physics
- Modules are plain THREE.js WebComponents
- Modules hotload on front + backend via [`archae`](https://github.com/modulesio/archae)
- Browser API for HMD + Controllers querying
- Per-frame, per-eye callbacks
- Positional audio support
- File upload/download integration
- HMD + controller emulation with keyboard + mouse
- It's just Javascript, so change whatever you like

## Quick install (Linux)

```bash
npm install git+https://github.com/modulesio/zeo.git # requires node 6+
```

:point_right: The _required dependencies_ are `build-essential cmake python ffmpeg`. These are needed to build some native node modules ([Bullet physics engine](https://github.com/bulletphysics/bullet3)) and for voice audio processing on the server. On Debian/Ubuntu you can get these dependencies with:

```bash
sudo apt-get install build-essential cmake python ffmpeg
```

If you're using a different package manager it almost certainly has these, under slightly different names.

## Example: Bouncy ball

Here is the full code for `Bouncy ball`, a little game you can play with tracked controllers. It's packaged as a Zeo module in [`plugins/demo`](https://github.com/modulesio/zeo/tree/master/plugins/demo).

```js
module.exports = archae => ({ // `archae` is the Zeo plugin loader
  mount() { // `mount` gets called when our plugin loads
    // request the `zeo` plugin API from `archae`
    return archae.requestPlugin('/core/engines/zeo')
      .then(zeo => {
        // grab the API veriables we need
        const {THREE, scene} = zeo;
        const world = zeo.getCurrentWorld();

        // declare some contants
        const COLORS = {
          GREEN: new THREE.Color(0x4CAF50),
          RED: new THREE.Color(0xE91E63),
        };

        // create the sphere and add it to the scene
        const sphere = new THREE.Mesh(
          new THREE.SphereBufferGeometry(0.1, 7, 5),
          new THREE.MeshPhongMaterial({
            color: COLORS.GREEN,
            shading: THREE.FlatShading,
            shininess: 0,
          })
        );
        sphere.castShadow = true;
        const startY = 1.2;
        sphere.position.y = startY;
        scene.add(sphere);

        // declare some state
        const position = new THREE.Vector3(0, 0, 0);
        const velocity = new THREE.Vector3(0, 0, 0);
        let lastTime = world.getWorldTime();

        // `_update` will be called on every frame
        const _update = () => {
          // update time
          const currentTime = world.getWorldTime();
          const timePassed = Math.max(currentTime - lastTime, 1);
          lastTime = currentTime;

          // calculate new position
          const newPosition = position.clone().add(velocity.clone().divideScalar(timePassed));
          const rayBack = newPosition.clone().multiplyScalar((-1 / timePassed) * 0.25);
          velocity.add(rayBack).multiplyScalar(0.98);
          position.copy(newPosition);

          // update sphere
          sphere.position.copy(newPosition);
          sphere.position.y += startY + Math.sin((currentTime * 0.00125) % (Math.PI * 2)) * 0.3;
          sphere.rotation.y = (currentTime * 0.002) % (Math.PI * 2);

          // detect hits
          const status = zeo.getStatus();
          const {gamepads: gamepadsStatus} = status;
          const lines = ['left', 'right'].map(side => {
            const gamepadStatus = gamepadsStatus[side];
            if (gamepadStatus) {
              const {position: controllerPosition} = gamepadStatus;
              return new THREE.Line3(controllerPosition.clone(), sphere.position.clone());
            } else {
              return null;
            }
          });
          const touchingLines = lines
            .map(line => {
              const distance = line ? line.distance() : Infinity;
              return {
                line,
                distance,
              };
            })
            .sort((a, b) => a.distance - b.distance)
            .filter(({distance}) => distance <= 0.1)
            .map(({line}) => line);
          if (touchingLines.length > 0) {
            const touchingLine = touchingLines[0];
            const delta = touchingLine.delta().normalize().multiplyScalar(2.5);
            velocity.copy(delta);
          }

          // style the sphere
          sphere.material.color = touchingLines.length > 0 ? COLORS.RED : CcOLORS.GREEN;
        };

        // listen for Zeo telling us it's time to update for the next frame
        zeo.on('update', _update);

        // set up a callback to call when we want to clean up after the plugin
        this._cleanup = () => {
          scene.remove(sphere);

          zeo.removeListener('update', _update);
        };
      });
  },
  unmount() { // `unmount` gets called when our plugin unloads
    this._cleanup();
  },
});
```

## API documentation

[Full API documentation is available here](https://github.com/modulesio/zeo/tree/master/docs/api.md). // XXX write this

## Awesome modules

Here's a showcase of some of the `npm` modules you can run on Zeo:

// XXX fill this in

## Features // XXX delete these

- Works with WebVR 1.0
- Fully emulates HMD + tracked controllers, if you don't have the browser or hardware for it
- A ton of included base modules to get you started, including:
  - Multi-world management with a backing database
  - _Server-side_ physics with JavaScript bindings to Bullet
  - Multiplayer support, which plays nicely with the physics server
  - Model loader
  - Positional audio
  - VR `bash` shell so you can hack while jacked
  - Youtube player
  - Portals you can walk through
  - Weather effects
  - Skybox with Rayleigh scattering, sun, moon, and stars
  - Everything is plain JS!

## In progress

  - A menu UI infrastructure
  - Plugin management without leaving VR
  - Voice controls and reading backed by Watson
  - Virtual tools you can pick up and play with
  - Keyboard emulation
  - Emulated game consoles with Retroarch

## Contact

Issues and PR's are welcome. If you want to reach me privately, I'm Avaer Kazmer <a@modules.io>.
