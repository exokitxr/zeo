# API

## API introduction

Zeo VR exposes a collection of APIs (including `THREE.js`, DOM elements, and input events) for your VR module to interact with the world, the user, and other modules.

These APIs live on the `zeo` global variable. You don't need to do anything special to access these APIs -- 

It is assumed that you already have a working Zeo VR server, and you're ready to write a VR module. If not, see [Getting started](#getting-started) and/or [Writing modules](#writing-modules).

## Elements API

The `elements` API is used to integrate your module into the DOM that keeps track of all modules in the VR world.

### registerElement()

`zeo.elements.registerElement()` lets you describe your module as a DOM [Custom element](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Custom_Elements) with user-configurable attributes.

### getRootElement()

`zeo.elements.getRootElement()` lets you access the root DOM node that contains all currently instantiated modules (represented as Custom DOM elements) in the VR world.

This is a regular `div` that lives in the DOM. However, should should not rely on it having any particular properties. Always access it via `elements.getRootElement`.

You can walk this DOM node to find which modules are currently live (including your own) and communicate with them via standard DOM events.

#### Example: cross-module events

```javascript
// my-plugin/client.js
class MyPlugin {
  mount() {
    class MyPluginElement extends HTMLElement {
      createdCallback() {
        this.addEventListener('somethingHappened', e => {
          console.log('something happened: ' + e.what);
        });
      }
    }

    zeo.elements.registerElement(MyPluginElement);
  }
}
```

```javascript
// my-other-plugin/client.js
class MyOtherPlugin {
  mount() {
    setInterval(() => {
      const rootElement = zeo.elements.getRootElement();
      const myPluginInstances = rootElement.querySelectorAll('z-my-plugin');

      const somethingHappenedEvent = new CustomEvent('somethingHappened', {
        what: 'something',
      });

      myPluginInstances.forEach(myPluginInstance => {
        myPluginInstance.dispatchEvent(somethingHappenedEvent);
      });
    }, 1000);
  }
}
```

## Pose API

The `pose` API lets you inspect the state of the user's VR pose.

This includes getting the position/orientation of the headset and controllers, the controller button state, and eye and stage matrices.

The Pose API is particularly useful for scenarios where you would like to instantaneously react to what the user is doing. For example, you might want to trigger an action based on the user's gaze target -- in which case you could cast a ray from the headset to some target object and react if an intersection is detected.

This API works the same way for all control modes, including mouse and keyboard, sit/stand, and room scale.

Use [Render API](#render-api) to synchronize your pose queries to the world frame rate.

### getStatus()

`zeo.vr.getStatus()` returns an object containing the current instantaneous headset and controllers state.

#### Get HMD pose

```javascript
const status = zeo.pose.getStatus();
const {hmd: {position, quaternion, scale}} = status;

console.log('current headset pose:', {
  position, // THREE.Vector3
  quaternion, // THREE.Quaternion
  scale, // THREE.Vector3
});
```

#### Get gamepads pose

```javascript
const status = zeo.pose.getStatus();
const {gamepads} = status;

['left', 'right'].forEach(side => {
  const gamepad = gamepads[side];
  const {position, quaternion, scale} = gamepad;

  console.log(`current ${side} controller pose:', {
    position, // THREE.Vector3
    quaternion, // THREE.Quaternion
    scale, // THREE.Vector3
  });
});
```

## Input API

The `input` API is used to access normalized DOM input events from the user.

This includes gamepad, mouse, and keyboard input (real and virtual) under a single normalized event system.

When possible,  prefer this API for detecting user input -- although it is technically possible to detect these events in other ways, such as native browser events or the [Pose API](#pose-api), this API abstracts away differences in browser behavior, hardware, and control schemes.

Note that when you add event listeners for the input events, you'll need to make sure the event listeners are removed when your element is destroyed (if added on element creation), or otherwise in your module's `unmount` function (if added in your module's `mount` function).

### Event side

All `input` API events have a `side` property equal to either `'left'` or `'right'`, depending on which hand corresponds to the controller that fired the event.

The `side` property exists for all input events, regardless of the actual control scheme being used -- even with mouse + keyboard controls there are two controllers with distinct `side`s.

Note that whether this might not correspond to the actual hand that the user is holding the controller in. The accuracy of this depends entirely on the browser API and user behavior. The main purpose of `side` is to distinguish and correlate controllers across multiple events. For example, if you do something on `gripdown` you might want to do something else on `gripup`, but you'll need to know _which_ controller fired the event so your code doesn't get confused when the user decides to grip both controllers simultaneously.

#### Track controller grip

```javascript
zeo.input.on('gripdown', e => {
  const {side} = e;
  console.log(`grip down on ${side} side`);
});

zeo.input.on('gripup', e => {
  const {side} = e;
  console.log(`grip up on ${side} side`);
});
```

### VR events

The `input` api emits the following virtual events.

You should prefer these over the browser-native events, since they work regardless of control scheme: for example, if the user is using the virtual keyboard, you will get `keyboardpress` but not `keypress` events..

|event|schema|description|
|-|-|-|
|`trigger`|`{side: String}`|Trigger button pressed.|
|`triggerdown`|`{side: String}`|Trigger button held.|
|`triggerup`|`{side: String}`|Trigger button released.|
|`pad`|`{side: String}`|Pad button pressed.|
|`paddown`|`{side: String}`|Pad button held.|
|`padup`|`{side: String}`|Pad button released.|
|`grip`|`{side: String}`|Grip button pressed.|
|`gripdown`|`{side: String}`|Grip button held.|
|`gripup`|`{side: String}`|Grip button released.|
|`menu`|`{side: String}`|Menu button pressed.|
|`menudown`|`{side: String}`|Menu button held.|
|`menuup`|`{side: String}`|Menu button released.|
|`keyboardpress`|`{side: String, keyCode: Number}`|Virtual keyboard key pressed. `keyCode` is the Javascript keycode for the corresponding key.|
|`keyboarddown`|`{side: String, keyCode: Number}`|Virtual keyboard key held. `keyCode` is the Javascript keycode for the corresponding key.|
|`keyboardup`|`{side: String, keyCode: Number}`|Virtual keyboard key released. `keyCode` is the Javascript keycode for the corresponding key.|

### Browser events

The `input` api proxies the following browser events.

Prefer to listen for these instead of adding native browser event listeners, which might have unexpected differences in capture, bubbling, and focus. Also note that you should prefer to use the [VR events](#vr-events) instead, so your code does not make assumptions about the user's control scheme.

|event|description|
|-|-|
|`click`|Browser native.|
|`mousedown`|Browser native.|
|`mouseup`|Browser native.|
|`mousewheel`|Browser native.|
|`keypress`|Browser native.|
|`keyup`|Browser native.|
|`paste`|Browser native.|

These are emitted exactly as reported by the browser.

## UI API

The UI API includes utilities for rendering interactive _2D_ HTML interfaces in the 3D scene.

This is useful for implementing displays and menu interfaces, and works out of the box with most static HTML, includng inline images.

The architecture is designed for VR-scale (90 FPS) performance, and implements fiber-like cooperative multitasking that prefers to yield instead of locking up the render loop and missing frames. The end result is a powerful UI rendering model that works for most use cases without too many caveats.

#### makeUi()

Use `zeo.ui.makeUi()` to create a `Ui` instance, which implements a single UI plane. This plane can contain an arbitrary `image`, `canvas`, or `html`.

#### Ui.addPage()

XXX

## Render API

The Render API emits events that you can listen for to be notified when we are about to render scene frames, as well as separate eye cameras.

This is particularly useful when you need to perform frame-accurate updates, such as an auxiliary camera render, or update something based on the user's VR pose (see the [Post API](#pose-api)).

### Render events

|event|schema|description|
|-|-|-|
|`update`|`null`|Emitted when we are about to render a VR frame. This event is emitted _before_ rendering starts, so any changes you make to the scene will be immediately reflected in the next frame.|
|`updateEye`|`THREE.PerspectiveCamera`|Emitted when we are about to render a single eye of a VR frame. For VR rendering modes you will get two of these events per frame, while for monoscoping rendering you will get one. The emitted camera is positioned and oriented for the target eye. This event is separate from `update` because there are cases for which you need different math per eye -- such as rendering a stereoscopic texture. This event is emitted _before_ rendering starts, so any changes you make to the scene will be immediately reflected in the rendering of the eye camera.|

## File API

The File API lets you access and decode files that have been added to the world.

This includes functionality such as finding files uploaded by the user, detecting the type of media they represent (e.g. image, audio, video, model), and translating these into a form usable by the rest of the APIs (such as DOM images and THREE.js models).

XXX

## Hands API

The Hands API is used to manage grabbing of objects in the scene. It includes utilities and events for handling targeting

XXX

## Multiplayer API

The Multiplayer API gives you access to the current state of all users connected to the server. This includes pose data and avatar meshes, as well as events that you can listen for when interesting things happen, such as users joining or leaving teh server.

XXX

## Sound API

The Sound API implements a positional audio subsystem that you can use to play audio media (`audio` and `video` tags) bound to specific objects in the scene, with realistic panning and gain attenuation.

XXX

## Physics API

The Physics API is a frontend interface to the server-side multiplayer physics engine (powered by Bullet).

This includes facilities for querying, constructing, adding, and removing physics bodies from the scene, binding them to THREE.js objects such as meshes, and helper utilities for things like debug box rendering and shaping physics bodies to your geometries.

The physics subsystem works out of the box and is automatically synchronized to multiplayer clients.

XXX


















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
