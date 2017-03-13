# API docs

## API introduction

Zeo VR exposes a collection of APIs (including `THREE.js`, DOM elements, and input events) for your VR module to interact with the world, the user, and other modules.

These APIs live on the `zeo` global variable. You don't need to do anything special to access these APIs -- 

It is assumed that you already have a working Zeo VR server, and you're ready to write a VR module. If not, see [Getting started](#getting-started) and/or [Writing modules](#writing-modules).

## Zeo API

The above describes how to write and load Zeo plugins that do nothing. To interact with the user and the Zeo world you'll want to use the API exported by `/core/engines/zeo`.

This lets you get at the THREE.js `THREE`, `scene`, `camera`, and `renderer` objects, listen for frame updates, and get user poses:

```js
module.exports = archae => ({
  mount() {
    return archae.requestPlugin('/core/engines/zeo')
      .then(zeo => {
        const {THREE, scene} = zeo;

        const COLORS = {
          GREEN: new THREE.Color(0x4CAF50),
          RED: new THREE.Color(0xE91E63),
          BLUE: new THREE.Color(0x2196F3),
        };

        const startY = 1.2;
        const radius = 0.1;

        const sphere = new THREE.Mesh(
          new THREE.SphereBufferGeometry(radius, 7, 5),
          new THREE.MeshPhongMaterial({
            color: COLORS.GREEN,
            shading: THREE.FlatShading,
            shininess: 0,
          })
        );
        sphere.position.y = startY;
        scene.add(sphere);

        const _update = () => {
          // update sphere position
          const currentTime = world.getWorldTime();
          sphere.position.y += startY + Math.sin((currentTime * 0.00125) % (Math.PI * 2)) * 0.3;
          sphere.rotation.y = (currentTime * 0.002) % (Math.PI * 2);

          // update sphere color when touched or looked at
          const {hmd, gamepads: gamepadsStatus} = zeo.getStatus();
          const touched = ['left', 'right'].some(side => {
            const gamepadStatus = gamepadsStatus[side];
            if (gamepadStatus) {
              const {position: controllerPosition} = gamepadStatus;
              return controllerPosition.distanceTo(sphere.position) < radius;
            } else {
              return false;
            }
          });
          const lookedAt = (() => {
            const ray = new THREE.Ray(hmd.position, new THREE.Vector3(0, 0, -1).applyQuaternion(hmd.rotation));
            const box = new THREE.Box3().setFromCenterAndSize(camera.position, radius * 2);
            const intersectPoint = ray.intersectBox(box);
            return Boolean(intersectPoint);
          })();
          sphere.material.color = (() => {
            if (touched) {
              return COLORS.RED;
            } else if (lookedAt) {
              return COLOR.BLUE;
            } else {
              return COLORS.GREEN;
            }
          })();
        };
        zeo.on('update', _update);

        this._cleanup = () => {
          scene.remove(sphere);

          zeo.removeListener('update', _update);
        };
      });
  },
  unmount() {
    this._cleanup();
  },
});
```
This plugin uses the Zeo API to add a sphere to the `scene` that Zeo has created for us, makes it float up and down in the scene, and colors it `BLUE` when we're looking directly at it or `RED` when we're touching it with tracked controllers.

We update the scene every frame on by listening for `zeo.on('update', _update)` and get the HMD and controllers status via `zeo.getStatus()`. These APIs are documented below.

### Exported objects

The Zeo API exports some standard THREE.js primitives as seen above. These include:

- `THREE`, the raw THREE.js API
- `scene`, the `THREE.Scene` for the current world
- `camera`, the `THREE.PerspectiveCamera` for viewing the current world
- `render`, the `THREE.WebGLRenderer` for rendering the current world

You can use these freely, as you would in any THREE.js app, but note that your plugin should conform to the module loader requirement that whatever you do in the `mount` step (such as adding objects to the `scene`) should be undone un the `unmount` step (such as removing the objects you added to the `scene`). If you don't this, your plugin will not behave correctly: it might leak resources, impact performance, or crash.

### Frame Events

The Zeo API doubles as an [`EventEmitter`](https://nodejs.org/api/events.html) that you can listen to for events relating to frame timing and and input.

The API is inherited from `node`: `zeo.on('eventName', eventHandler)` registers `eventHandler` to listen for `'eventName'` events and `zeo.removeListener('eventName', eventHandler)` unregisters it. The events you can subscribe to are:

#### `update`

The `update` event fires _before_ every frame is rendered. It's intended to let plugins perform update that need to happen on every frame, such as applying velocities to positions.

```js
module.exports = archae => ({
  mount() {
    return archae.requestPlugin('/core/engines/zeo')
      .then(zeo => {
        zeo.on('update', () => {
          console.log('about to render a frame!');
          // time to update stuff...
        });
      });
  },
```

Note that since listeners for the `update` event run on every frame, they need to be fast.

That is, you shouldn't be iterating over large arrays, adding materials or textures, and other expensive things in your `update` function. If you need to do these, you should prefer:

- precomputation in `mount`
- asynchronous computation in a worker
- doing the work in a vertex/fragment shader

#### `updateEye(camera)`

The `updateEye` event fires before each eye is rendered, and receives the eye's `camera` as an argument.

```js
{
module.exports = archae => ({
  mount() {
    return archae.requestPlugin('/core/engines/zeo')
      .then(zeo => {
        zeo.on('updateEye', camera => {
          console.log('about to render with eye camera!', camera);
          // time to update stuff...
        });
      });
  },
};
```

The `camera` argument is the `THREE.PerspectiveCamera` for the eye being rendered. `updateEye` is most useful for cases where you want to render something that _depends on the eye camera_ but _is not accounted for by the camera's transform matrix_. An example is rendering to a texture that depends on the camera, if you want the texture to be stereoscopic (such as a portal).

Note that `updateEye` and `update` are _not_ interchangeable. In the stereoscopic rendering case you will get _two_ `updateEye` events per frame, so you'd be doing double the work ad double the rate.

For consistency, `updateEye` will fire even if the renderering is monoscopic. In that case there will be a single `updateEye` event and a single `update` event fired.

In general, prefer to use `update` instead of `updateEye`.

#### Input events

Interacting with the VR world is a bit different than interacting with a regular browser page. For example, you want to be able to take input events from tracked controllers, which have buttons that do not correspond to anything on a standard keyboard or mouse. You'll want to know _which_ controller your events are coming from. And with features such as virtual keyboards, some logical events do not correspond to any native event in the browser.

For this reason, Zeo abstracts input events for you. It listens to the hardware and passes events to you through the regular `EventEmitter` interface. For example, listening to tracked controller events:

```js
module.exports = archae => ({
  mount() {
    return archae.requestPlugin('/core/engines/zeo')
      .then(zeo => {
        const _trigger = event => {
          const {side} = event;
          console.log('trigger pressed on ' + side + ' controller!');
        };
        zeo.on('trigger', _trigger);
      });
  },
};
```

The full list of available events is:

- `trigger` `{side: 'left'}`
  - Fired when the controller's `trigger` button is pressed. The `side` argument tells you whether the `left` or `right` controller was pressed.
- `triggerdown` `{side: 'left'}`
  - Fired when the controller's `trigger` button is pushed _down_.
- `triggerup` `{side: 'left'}`
  - Fired when the controller's `trigger` button is released _up_.
- `pad` `{side: 'left'}`
  - Fired when the controller's `pad` button is pressed. The `side` argument tells you whether the `left` or `right` controller was pressed.
- `paddown` `{side: 'left'}`
  - Fired when the controller's `pad` button is pushed _down_.
- `padup` `{side: 'left'}`
  - Fired when the controller's `pad` button is released _up_.
- `grip` `{side: 'left'}`
  - Fired when the controller's `grip` button is pressed. The `side` argument tells you whether the `left` or `right` controller was pressed.
- `gripdown` `{side: 'left'}`
  - Fired when the controller's `grip` button is pushed _down_.
- `gripup` `{side: 'left'}`
  - Fired when the controller's `grip` button is released _up_.
- `menu` `{side: 'left'}`
  - Fired when the controller's `menu` button is pressed. The `side` argument tells you whether the `left` or `right` controller was pressed.
- `menudown` `{side: 'left'}`
  - Fired when the controller's `menu` button is pushed _down_.
- `menuup` `{side: 'left'}`
  - Fired when the controller's `menu` button is released _up_.
- `keyboardpress` `{ key: 'a', keyCode: 65, side: 'left' }`
   - Fired when a virtual keyboard key is pressed.
   - `key` is the textual representation of the key. `keyCode` is the corresponding Javascript-compatible key code. `side` is whether the `left` or `right` controller was used to press the key. 
- `keyboarddown` `{ key: 'a', keyCode: 65, side: 'left' }`
  - Fired when a virtual keyboard key is pushed _down_.
- `keyboardup` `{ key: 'a', keyCode: 65, side: 'left' }`
  - Fired when a virtual keyboard key is released _up_.

// XXX describe event priorities and how event.stopImmediatePropagation() short-circuits

### Status API

// XXX finish this














### Engine API

The first thing you'll need to do to get access to the rest of Zeo's APIs is to request the Zeo engine with `archae.requestEngine()`. Per the Archae specification, you can get the `archae` loader instance by grabbing it in the top-level function that's exported from your module:

```js
module.exports = archae => { // here
  mount() {
    console.log('got archae loader!', {archae});
  },
};
```

Once you've done that, you get the Zeo engine instance with `archae.requestEngine('/core/engines/zeo')`. This returns a `Promise` that will resolve to the Zeo API root:

```js
module.exports = archae => {
  mount() {
    return archae.requestEngine('/core/engines/zeo')
      .then(zeo => {
        console.log('got Zeo API!', {zeo});
      });
  },
};
```

Note the `return archae.requestEngine()`: per the Archae specification, the `mount` function can return a Promise that will resolve once the mod completes its loading. Since our mod technically depends on loading the Zeo engine API, `return archae.requestEngine()` magically does the correct thing. We could load multiple things with `Promise.all`, or continue the `Promise` chain if we wanted to load more stuff here and it would "just work", but we'll stick with the simple example for now.

The rest of what your module does communicates with Zeo through the API you get out of the resolved `archae.requestEngine('/core/engines/zeo')`.

### Scene API

Zeo loads `THREE.js` and sets up the `scene` rendering for you, and exposes these at the root of the Zeo API.

```js
module.exports = archae => {
  mount() {
    return archae.requestEngine('/core/engines/zeo')
      .then(zeo => {
        const {THREE, scene, camera, renderer} = zeo;

        console.log("got Zeo's THREE and scene!", {THREE, scene, camera, renderer});
      });
  },
};
```

These objects (`THREE`, `scene`, `camera`, `renderer`) are the bare THREE.js APIs and you can immediately use them to add meshes and other objects to the THREE.js scene graph. There's no magic here and you have the full THREE.js API at your disposal.

Here we add a green sphere floating in the middle of the scene:

```js
module.exports = archae => {
  mount() {
    return archae.requestEngine('/core/engines/zeo')
      .then(zeo => {
        const {THREE, scene} = zeo;

        const sphere = new THREE.Mesh(
          new THREE.SphereBufferGeometry(0.1, 5, 4),
          new THREE.MeshPhongMaterial({
            color: 0x4CAF50,
            shading: THREE.FlatShading,
            shininess: 0,
          })
        );
        scene.add(sphere);

        this._cleanup = () => {
          scene.remove(sphere);
        };
      });
  },
  unmount() {
    this._cleanup();
  },
};
```

Note that a full example of this mod is available as a demo plugin in the [plugins/demo/](/plugins/demo/).

### Zeo update callbacks API

Since Zeo is fundamentally about interactive VR, you will probably want a way to "do something on every frame", or "do something for each eye camera" -- such as advance an animation or render something stereoscopically.

The Zeo framework is the "owner" of the VR camera, the rendering pipeline, and timing, so to be able to do stuff (like updating animations), you'll need to be able to hook in your code at the right time in a frame. That's what the update callbacks are for.

All callbacks are declared by your mod via the [Archae specification](https://github.com/modulesio/archae). That is, your mount function should return (a `Promise` that resolves to) an object with the callback key mapping to the callback handler:

```js
module.exports = archae => {
  mount() {
    return archae.requestEngine('/core/engines/zeo')
      .then(zeo => {
        return {
          update() {
            console.log('about to render a frame');
          },
        };
      });
  },
};
```

#### `update`

The `update` callback will fire _before_ Zeo renders every frame. This lets you do additional work that needs to be done per frame, such as updating animations.

```js
module.exports = archae => {
  mount() {
    return archae.requestEngines('/core/engines/zeo')
      .then(zeo => {
        const {THREE, scene} = zeo;

        const object = new THREE.Object3D(); // or new THREE.Mesh() etc.
        const y = 5;
        object.position.set(0, y, 0);
        scene.add(object);
        this.object = object;

        this._cleanup = () => {
          scene.remove(object);
        };

        let i = 0;

        return {
          update() {
            object.position.y = y + Math.sin(Math.PI * i * 0.001); // a hacky version of gravity in which time flows in lockstep with your framerate

            i++;
          },
        };
      });
  },
  unmount() {
    this._cleanup && this._cleanup();
  },
};
```

Note that whatever your `update` callback runs once per frame, so it needs to be fast.

This means your `update` callback should not add or remove objects from the scene, construct new materials (`new THREE.Material()`), or do heavy math.

If you need to do these things, the right place to do them is in the `mount` function; if this setup needs to be asynchronous (such as needing to fetch resources), your `mount` function can return the appropriate `Promise`.

#### `updateEye`

The `updateEye` callback is similar to `update`, only it will get called once _per eye_ being rendered (generally, twice per frame).

Additionally, it gets passed the `camera` that correponds to the eye being rendered. You can use the `camera` object to perform additional computation or set up shader parameters for more complicated rendering passes. For example, if you want to render a stereoscopic portal texture, `updateEye` is the way you'd do it.

Note that `update` and `updateEye` are _not_ mutually exclusive. You can use both, in which case `updateEye` will be called for each eye, followed by `update`.

### Zeo status API

The Zeo status API lets you get details about the current user state -- their Head Mounted Display (HMD) pose, controller poses, and button states.

// XXX

### Zeo world API

The Zeo world API lets your mod get details about the currently loaded VR world -- such as accurate world timing information for animations. For this, the Zeo engine exports a `getCurrentWorld()` function:

```js
module.exports = archae => {
  mount() {
    return archae.requestEngines('/core/engines/zeo')
      .then(zeo => {
        const {THREE, scene} = zeo;

        const object = new THREE.Object3D(); // or new THREE.Mesh() etc.
        object.position.set(0, 5, 0);
        scene.add(object);
        this.object = object;

        this._cleanup = () => {
          scene.remove(object);
        };

        let lastWorldTime = zeo.getCurrentWorldTime();

        return {
          update() {
            const currentWorldTime = zeo.getCurrentWorldTime();
            const timeDiff = currentWorldTime - lastWorldTime;
            object.position.y = Math.sin(Math.PI * timeDiff * 0.001); // a less hacky version of gravity that is synchronized to the world rather than your framerate

            lastWorldTime = zeo.getCurrentWorldTime();
          },
        };
      });
  },
  unmount() {
    this._cleanup && this._cleanup();
  },
};
```

The API behind the `World` object exported from is still settling, but you can rely on `getWorldTime()` being available, for getting the current number of milliseconds that the world has been executing.

### Zeo elements API

The Zeo elements API is a way for mods to comunicate -- with the user (via configuration in the menu interface), and with each other (via a DOM object model and event system). The key idea is that a Zeo mod can export a specification for custom DOM elements, and these can be added to the world and configured by the user.

Here's a simple example of a mod that allows user-configurable placement of a cube:

```js
// XXX
```

There are basically three parts to the elements API: `element declarations`, `attrbute declarations`, and `template declarations`. We'll tackle them individually.

// XXX
