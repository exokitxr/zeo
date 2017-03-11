# Module API

This document specifies what you need to do to write your own Zeo plugins, which are self-contained units of code you can add to your Zeo worlds.

It is assumed that you already have a Zeo server running. If not, see [Getting started](https://github.com/modulesio/zeo/tree/master/docs/getting-started.md).

## Introduction

A Zeo plugin is just an [`npm`](https://www.npmjs.com/) module: that is, a [`package.json`](https://docs.npmjs.com/files/package.json) plus the Javascript files with your plugin code.

The only difference between a Zeo plugin and any other `npm` module is some extra keys in the `package.json` that tell Zeo how to start it and stop it. Your plugin will probably also probably  `requestPlugin('zeo')` to interfact with the Zeo world.

If you're a hands-on learner, you might want to simply dive into the [`Bouncy ball` demo plugin](/plugins/demo/). Otherwise, read on for the full Zeo plugin specification.

## Module specification

Under the hood, Zeo uses the [`archae`](https://github.com/modulesio/archae) module loader. It's just a way of writing client/server `npm` modules that can be started and stopped dynamically.

### Package format

The main thing that makes an `npm` module compatible with Zeo is that its `package.json` includes the keys `client`, `server`, or `worker` (all of which are optional). These should point to the (package-relative) `.js` files you want to run in the corresponding environments:

#### package.json
```js
{
  "name": "my-plugin",
  "version": "0.0.1",
  "keywords": ["zeo-mod"],
  "client": "client.js",
  "server": "server.js",
  "worker": "worker.js"
}
```

Also note the `"keywords": ["zeo-mod"]`: this is used by Zeo to find your module when searching `npm`. It's not required to load

The reference `.js` files (e.g. `client.js`) should export `mount` and `unmount` functions to call when your plugin is to be started or stopped, respectively:

#### client.js
```js
module.exports = {
  mount() {
    console.log('plugin loading!');
  },
  unmount() {
    console.log('plugin unloading!');
  },
};
```

### Plugin APIs

In addition to loading and unloading plugins, Zeo lets plugins export their APIs and import other plugin's APIs.

### Import a plugin's API

To import a plugin API, use a `function` or `class` at the top-level `export default` or `module.exports` of your Javascript file, to capture the `archae` object:

#### client.js
```js
export default const MyPluginClient = archae => {
  mount() {
    return archae.requestPlugin('/core/engines/zeo') // load the Zeo plugin
      .then(zeo => {
        console.log('got the Zeo API!', zeo);
      });
  },
};
```

The important part is the call to `archae.requestPlugin()`, which lets us request other plugins. The return value of this function is a `Promise` that will `resolve` to the API that's exported by that plugin, or `reject` with an error describing how loading the plugin failed.

In this case we are requesting the `/core/engines/zeo` plugin, which resolves to the Zeo plugin API. This betrays a key design principle of Zeo: it's actually just a plugin! That is, Zeo is just plugins all the way down.

Also note the `return archae.requestPlugin(...)`: we are returning a `Promise` from `mount`. In this case, it means we want the plugin's loading to wait until the returned `Promise` resolves. This is also the mechanism that allows a plugin to export its own API for other plugins to consume.

### Export your plugin's API

To export an API for your plugin, simply return (a `Promise` that resolves to) your API from the plugin's `mount` function in its Javascript implementation file.

Returning a regular value means that the plugin should be considered loaded immediately, while returning a `Promise` means you want to wait for the plugin to load until the `Promise` resolves. Either way, the behavior is the same from the user's perspective: the resolved value of the `Promise` that the user gets as the result of calling `archae.requestPlugin()` will be the API your plugin exports.

Here's an example of a plugin exporting an API and another plugin importing it for use:

#### database/client.js
```js
export default class Database {
  mount() {
    return new Promise((accept, reject) => {
      const databaseInstance = {}; // load the database instance somehow...
      accept(databaseInstance);
    })
      .then(databaseInstance => {
        const databaseApi = {
          get(key) {
            return new Promise((accept, reject) => {
              // get the value from databaseApi and accept() it...
            });
          },
          set(key, value) {
            return new Promise((accept, reject) => {
              // set the value from databaseApi and accept() when done...
            });
          },
        };
      });
  }

  unmount() {}
}
```

#### some-other-plugin/client.js
```js
module.exports = archae => {
  mount() {
    return archae.requestPlugin('database')
      .then(database => {
        // call database.get() or database.set() here to use the database...
      });
  }

  unmount() {}
};
```

## Loading modules

Now that you know how to write modules, you'll need to know how to load them into Zeo.

There are two ways to do this: you can either installed from the local filesystem (in which case the plugin will only be available to your server), or publish to the public `npm` registry (in which case the plugin will be available for anyone to find and install). Either way, there's no difference in functionality and the code for your module is the same.

### Option 1: Local install

This method is most useful for testing plugins as you develop them, without the overhead of publishing and downloading from `npm`.

To use a plugin locally, simply drop your `npm` module (which otherwise meets the same Zeo mods specification) into Zeo's `plugins/` directory. For example, `plugins/my-mod` would be the right place to put a `zeo` plugin named `my-mod`.

Once you've done this, you'll be able to add your plugin to Zeo the normal way, by going to `Mods > Local Mods` in the main Zeo menu. You can only do this on the server where you dropped your plugin.

// XXX explain reinstalls

### Option 2: Publish to npm

Publishing your plugin to `npm` is the best way to deliver your module to anyone running Zeo. This is mostly just a straightforward [`npm publish`](https://docs.npmjs.com/cli/publish). The only additional thing you need to do is to make sure that `"zeo-mod"` is included in your `"keywords" array in `package.json`, so Zeo knows how to find your module.

```js
// package.json
{
  "name": "my-mod",
  "version": "0.0.1",
  "keywords": [
    "zeo-mod"
  ],
  "client": "client.js"
}
```

To install a Zeo mod that was published to `npm`, go to `Mods > Npm search` in the main Zeo menu. Anyone running a Zeo server will be able to search for your mod and install it this way.

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
