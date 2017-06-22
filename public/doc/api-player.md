## `player` API

This API lets you track the players on the server, including yourself.

Each player has a `playerId`. This is a string that's unique to each client connected to the server. Note that this is not the same thing as the client's [`VRID`](/docs/vrid). If a user opens multiple tabs/windows to the same server, each connection will have a different `playerId`, but most likely the same `VRID`.

You can use the `playerId` as a player data lookup key in your mods.

#### `getId()`

This returns the current player's  `playerId` `string`.

It's a constant, but different for every browser session. That means you can rely on it the whole time your `client` is loaded, but if you store it on the `server` you're probably doing something wrong and you're gonna have a bad time. &x1F63F;

#### `getRemoteStatuses()`

This is the main way to query the status of other players. The status includes the headset and gamepads positions and orientations for every user.

```
const {player} = zeo;
const statuses = player.getStatuses();
statuses.forEach(status => {
  const {
    playerId,
    status: {
      hmd: {
        position,
        rotation,
        scale,
      },
      controllers: {
        left: {
          position,
          rotation,
          scale,
        },
        right: {
          position,
          rotation,
          scale,
        },
      },
    },
  } = status;
  console.log(`player ${playerId} has their head at ${position.join(', ')}`);
});
```

- `playerId`: Unique `string`.
- `position`: `Array` with the shape `[0, 0, 0]`. Represents the _world_ position vector.
- `rotation`: `Array` with the shape `[0, 0, 0, 1]`. Represents the _world_ quaternion.
- `scale`: `Array` with the shape `[1, 1, 1]`. Represents the _world_ scale vector.

Additional notes:

- The current player _does not appear_ in this list. The current player's status can be gotten from the [`pose` API](/docs/api-pose).
- Properties are arrays. If you want to use them with [THREE.js](/docs/api-three), you can easily use `new THREE.Vector3().fromArray(position)` and friends. See the full [`THREE.js` docs](https://threejs.org/docs/).
- Properties are _world relative_. Uou can compare these against objects in the world directly, but a difference of `1` here does not mean the user physically moved 1 meter.

#### `getRemoteStatus(playerId)`

Just like `getRemoteStatuses()`, except it lets you get a single player status instead of the full load.

#### `playerEnter({id, status})` event

Emitted when a new player enters the server. You can listen for this directly on the `player` object:

```
const {player} = zeo;
player.on('playerEnter', ({id, status}) => {
  console.log(`player ${id} entered`);
});
```

You also get passed the `status` object for convenience. This is the same this you would get if you called `getRemoteStatus(id)`.

Note that `playerEnter` is only emitted when a player actually joins. That means to know about all players on the server you mod's gotta use both `getRemoteStatuses` _and_ the events, or you might be left out of the loop about users that were already there when your mod loaded.

#### `playerLeave({id})` event

Emitted when a player leaves the server.

The opposite of `playerEnter` event. Everything that applies to `playerLeave` applies to this one as well.

#### `playerStatusUpdate({id, status})` event

Emitted when an player on the server moves.

You'll only get this for players that were already on the server, and only when the player's `status` actually changed. This is the thing you want to listen for to update stuff in your mod that depends on a remote user's pose.
