## Modules specification

Mods are just [`npm` modules](https://npmjs.org/).

To get a mod to show up on a VR server, you add the `zeo-mod` keyword to your [`package.json`](https://docs.npmjs.com/files/package.json) and publish normally:

###### package.json
```
{
  "name": "example",
  "version": "0.0.1",
  "keywords": ["zeo-mod"]
}
```

For _local development_ you can put your mod as a directory under `/mods` on your server. This works the same as if you'd published it, except you don't need to publish and nobody else can see your mess yet. &#x1F44C;

That's it! The rest of this document explains how to structure your module to actually make it do stuff.

#### Module loader

Installing mods uses plain [`npm install`](https://docs.npmjs.com/cli/install).

Mods are hot-loaded and hot-unloaded in the VR world. Your mod describes how to start and stop itself, in both the browser and on the server. This is optional, but if your mod actually does _something_, you'll want to hook in at one or all of these points. &#x1F4AA;

The module loader we use is called [`archae`](https://github.com/modulesio/archae). It's just a way to describe these entrypoints. The entrypoints are described by keys in your `package.json`:

###### packgage.json
```
{
  // ...
  "client": "client.js", // load this in the browser
  "server": "server.js", // load this on the server
  // ...
}
```

The `client` and `server` keys should point to Javascript files in your npm package. These files should themselves be `require`able files -- that is they can `require` other files and modules, and should `export` their API with `module.exports`.

#### Synchronous `mount` and `unmount`

The `archae` module loader uses `mount` and `unmount` functions to load and unload your mods.

These functions should be exported from your `client` and/or `server` files:

###### client.js or server.js
```
module.exports = {
  mount: () => {
    console.log('module mounting!');
  },
  unmount: () => {
    console.log('module unmounting!');
  },
};
```

Predictably, `mount` is called to load your mod and `unmount` is called to unload it. You can do whatever setup/teardown you like in these functions.

#### Asynchrounous `mount` and `mount`

Your `mount` and `unmount` functions can return a `Promise` to signal that they are asynchronous.

That is, it's not required that our `mount` and `unmount` do all loading/unloading on this tick, since that's not possible in the general case. `mount` and `unmount` can triggeer asynchronous work and the load/unload will not be considered complete until the corresponding `Promise` resolves (or errors).

Your mod has a lot of liberty with the kind of loading and unloading it can do (such as reading files, making requests, forking processes, and so on), but there is _one_ goldern rule: *clean up after yourself*. Anything done by `mount` must be undone by `unmount`. If this requirement is not met, repeatedly loading and unloading your module can trigger weird behavior or crashes and we'll all have a bad time &#x1F63F;.

Note that if your `Promise` does not resolve or error at all, loading your mod will hang. If it's possible for your load to literally take forever, add reasonable timeouts.

Also note that a rejected Promise is taken as an indication of a broken mod and it will be considered unloaded afterwards.

#### Conclusion

That's all you need to know to get your module working.

Now time for the juicy bit: the APIs your module can use to do VR stuff, blockchain stuff, and other stuff. Continue to API docs.
