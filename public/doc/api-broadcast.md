## `broadcast` API

This API is used by entities for communicating _between different clients_.

If you want to communicate between mods _on the same client_, see [`entity` API](/docs/api-entity). And if you wanna communicate between servers, you probably want the [Mods spec](/docs/mods-spec).

#### How it works

Basically, the `broadcast` API is a [standard `EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) that emits events between different clients. This should just work, as long as your event data is `JSON`-serializable. Under the hood this is implemented as a WebSocket that routes through the server.

If you need to label your events with the _user_ doing the event, you can look up player ids with the [`player` API](/doc/api-player).

Event names are global, so you are highly encouraged to _prefix event names by your mod name_. For example, if your `superclicker` mod wants to emit a click event you would `broadcast.emit('superclicker:click', clickData)`.
