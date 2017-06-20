## `pose` API

The pose API is for tracking the user's headset and controllers. You can use it to get the `position`, `rotation`, and `scale` of these objects, as well as button input states, and be informed of _input events_ as they occur.

You could compute some of this by looking at the [`three` API](/docs/three-api) objects, but the `pose` API is faster and cleaner to work with.

`pose` API works great with [`render` API](/docs/render-api) for timing. With these two you can implement vitually any 3D interaction you can imagine.

#### `getStatus()`

This function returns the current state of the user's headset and controllers.

```
const {pose} = zeo;
const status = pose.getStatus();
const {
  hmd: {
    position,
    rotation,
    scale,
    worldPosition,
    worldRotation,
    worldScale,
  },
  gamepads: {
    left: {
      position,
      rotation,
      scale,
      worldPosition,
      worldRotation,
      worldScale,
      buttons: {
        pad: {touched, pressed, value},
        trigger: {touched, pressed, value},
        grip: {touched, pressed, value},
        menu: {touched, pressed, value},
      },
      axes: [x, y],
    },
    right: {
      position,
      rotation,
      scale,
      worldPosition,
      worldRotation,
      worldScale,
      buttons: {
        pad: {touched, pressed, value},
        trigger: {touched, pressed, value},
        grip: {touched, pressed, value},
        menu: {touched, pressed, value},
      },
      axes: [x, y],
    },
  },
} = status;
```

###### Parent-relative properties

- `position`: `THREE.Vector3`
- `rotation`: `THREE.Quaternion`
- `scale`: `THREE.Vector3`

These properties are user-relative and do not account for things like world scale and stage/teleport offsets.

Useful for comparing physical user movements since a difference of `1` here means a meter for the user, but these cannot be compared with actual world object positions, since the world can be offset, rotated, and scaled to a completely different set of coordinates.

In 3D scene graph terms, these are object-local coordinates that get transformed by the world matrix (`.matrixWorld`) before rendering.

###### World-relative properties

These properties are the same as the parent-relative properties, except already multiplied by the world matrix. If the left gamepad `worldPosition` is `(0, 1, 0)` then it's in the same place as a box placed at `(0, 1, 0)` in the scene.

The tradeoff is that these properties do not correspond directly to user motion. That is, if the controller `worldPosition` changes by `1` that doesn't mean the user moved their arm 1 meter, and if the `worldRotation`  is upside down that doesn't mean the user is holding the gamepad upside down.

- `worldPosition`: `THREE.Vector3`
- `worldRotation`: `THREE.Quaternion`
- `worldScale`: `THREE.Vector3`

###### Button properties

- `touched`: `boolean` whether the button is touched by the user, but not necessarily pressed down
- `pressed`: `boolean` whether the button is pressed down by the user
- `value`: `number` the force with which the button is being pressed

###### Axis properties

- `axes` `[number, number]` the touchpad/control stick axis coordinates pressed by the user, in the range `[-1, 1]`

#### `getStageMatrix()`

Returns a `THREE.Matrix4` that transforms the object-local coordinate space into the world coordinate space.

Note that both types of coordinates are provided to you in `getStatus()`, but you can also use this raw matrix to do special 3D math between them.

#### `getContollerLinearVelocity(side)`

- `side`: 'left' or 'right'

Returns a `THREE.Vector3` with the user-local instantaneous positional velocity of the requested gamepad, in _meters per second_. Useful for getting force for throwing gestures.

#### `getControllerAngularVelocity(side)`

- `side`: 'left' or 'right'

Returns a `THREE.Vector3` with the user-local instantaneous orientational velocity of the requested gamepad, in _meters per second_. Useful for getting twist for throwing gestures.
