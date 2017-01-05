# Zeo mods

This document specifies what you need to do to write your own Zeo mods.

The high-level oveview is that you write `mount` and `unmount` functions as your entry points, add objects to the VR scene with plain `THREE.js`, and publish the result to `npm`. Everything here is free-form Javascript; Zeo is the glue that delivers the Javascript to your face.

There's an escape hatch to `glsl`, `node`, `npm` and the full internet ecosystem if you need it.

What follows is a _Getting started_ guide and a specification.

## Getting started

// XXX

## Specification

Zeo mods follow the [Archae mods specification](https://github.com/modulesio/archae). That is, you should define `"client"`, `"server"`, and/or `"worker"` files in your `"package.json"`, and have them export `mount` and `unmount` functions so the loader knows how to load them. Once you've done this, your module can be loaded into Zeo, even if it technically doesn't do anything.

Example skeleton:

#### package.json

```js
{
  "name": "test-mod",
  "client": "client.js",
  "keywords": ["zeo-mod"]
}
```

#### client.js

```js
module.exports = () => {
  mount() {
    console.log('mounted!');
  },
  unmount() {
    console.log('unmounted!');
  },
};
```

To actually add functionality to your moduel, you'll probably want to _add stuff to the Zeo scene in the `mount` function_ and _remove it in the `unmount` function_.

Technically speaking, Zeo is an Archae engine that wraps `THREE.js`: Zeo takes care of setting up the `scene` you'll be using, adds some infrastructural components such as HMD and controller tracking, and sets up the Archae loader for your modules.

But you don't have to worry about any og that; the only thing you need to do as a Zeo mod is to interact with the `THREE.js` scene that Zeo sets up for you. The API follows.

### Zeo engine API

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

### Zeo scene API

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
        object.position.set(0, 5, 0);
        scene.add(object);
        this.object = object;

        this._cleanup = () => {
          scene.remove(object);
        };

        return {
          update() {
            object.position.y -= 0.001; // a hacky version of gravity
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

The Zeo world API lets your mod get details about the currently loaded VR world -- such as accurate world timing information for animations. For this, the Zeo engine exports a `getWorld()` function.

// XXX

### Zeo elements API

The Zeo elements API is a way for mods to comunicate -- with the user (via configuration in the menu interface), and with each other (via a DOM object model and event system). The key idea is that a Zeo mod can export a specification for custom DOM elements, and these can be added to the world and configured by the user.

Here's a simple example of a mod that allows user-configurable placement of a cube:

```js
// XXX
```

There are basically three parts to the elements API: `element declarations`, `attrbute declarations`, and `template declarations`. We'll tackle them individually.

// XXX

## Local mods

Zeo supports two sources of mods: you can either installed from the local filesystem (in which case the mod will only be available to your server), or publish to the public `npm` registry (in which case anyone will be able to find and install your module).

The former of these is most useful for testing mods as you develop them, without the overhead of constantly publishing and downloading from `npm`.

To use the local mod installation feature, simply drop your `npm` module (which otherwise meets the same Zeo mods specification) into Zeo's `plugins/` directory. For example, `plugins/my-mod` would contain an `npm`-compatible mod named `my-mod`.

Once you've placed your mod in `plugin/`, you'll be able to add it to Zeo the normal way,  by going to `Mods > Local Mods` in the main Zeo menu.

// XXX explain reinstalls

## Publishing to `npm`

Zeo mods can be published to `npm` for consumption by anyone running Zeo, right from the VR interface. The only additional thing you need to do to make this work is to add `"zeo-mod"` to your `"keywords" array in `package.json`, so Zeo knows how to find your module.

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

The mod format is the same regardless of whether you want your mod to be local or puplushed to `npm`. You can publish to `npm` in the usual way; just note that there might be a short delay (seconds to minutes) between when you publish your module and when it becomes visible in the search results.

To install a Zeo mod that was published to `npm`, go to `Mods > Npm search` in the main Zeo menu.
