## `input` API

This API emits VR input events that work the same for both mouse + keyboard and VR mode.

#### VR Events

These are the main VR events.

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

These are native browser events that the `input` API emits.

It's best to use the VR events (e.g. `trigger`) instead of browser events (e.g. `click`) because browser events don't handle differences in control scheme and hardware. But there are cases where you truly need to capture or prevent browser behavior on the same tick, so the input API kindly passes them through for those rare cases. &#x1F64F;

|event|description|
|-|-|
|`click`|Browser native.|
|`mousedown`|Browser native.|
|`mouseup`|Browser native.|
|`mousewheel`|Browser native.|
|`keypress`|Browser native.|
|`keydown`|Browser native.|
|`keyup`|Browser native.|
|`paste`|Browser native.|
