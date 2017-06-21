## `render` API

This API is used to track world rendering events. It acts as a normalization layer for both mouse + keyboard and headset rendering and presents the same API in either case.

#### `update` event

This event is emitted when it's time to render a frame. It happens once per frame, per entity.

The full `update` cycle needs to happen at rought 90 FPS (frames per second) in VR mode. All mods must finish their `update` in the time between these frames (11 milliseconds). So, we can't do major computation (long or unbounded loops, data crunching) in `update` handlers. If we need to do that, we should precompute things in the `mount` function, trigger an asynchronous `WebWorker` job, or make a request to do the work on the server.

Although every entity is guaranteed one `update` per frame, the order of `update` events _between_ entities is undefined. So if two entities are writing the same data, they need to synchronize with each other, or they'll interfere with each other in random ways. Some help might be found in the `renderStart` and `renderEnd` events.

```
const {render} = zeo;

render.on('update', () => {
  console.log('time to render one frame!');
});
```

#### `updateEye(camera)` event

This event is emitted when it's time to render an eye. It happens _either_ once or twice per scene, and receives the eye `camera` instance being rendered.

Sometimes you need to do something different for each eye camera when rendering. One example is rendering a 3D texture on a surface, such as a portal. In that case you'd listen for `updateEye` and render the texture using the provided camera, and it will work regardless of whether the user is using VR mode or not.

If your update work doesn't depend on the difference between eye cameras, use `update` instead. Otherwise you might be halving your function's performance in VR. &#x1F631;

```
const {render} = zeo;

render.on('update', camera => {
  console.log('time to render one eye!', camera.position.toArray());
});
```

#### `renderStart` event

This event happens on every frame, _before_ we start doing any other update work for any entity.

This can be useful in some cases, such as if we'd like to hide or show objects from rendering (i.e. set `.visibility = false`) depending on some condition. In that case we couldn't just use `update` because by the time our entity gets the event, other entities might have already rendered the wrong thing.

#### `renderStart` event

This event happens on every frame, _after_ we finish doing all update work for all entities.

This is useful in the smae situations as `renderStart`, or for cleaning up temporary things done by `renderStart`.
