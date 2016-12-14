# zeo.sh

JavaScript `npm` plugins in WebVR.

Zeo.sh lets you run `npm` modules in VR, from your browser. Under the hood it's a `Three.js` / `WebVR` rendering engine that polyfills the complexity of getting things working, so you can write a JS file and (literally) experience it running. Everything is nicely glued together by the [`archae`]() `npm` module loader.

:warning: Heavy development, expect things to be broken.

## Features

- Works with WebVR 1.0
- Fully emulates HMD + tracked controllers, if you don't have the browser or hardware for it
- A ton of included base modules to get you started, including:
  - Multi-world management with a backing database
  - _Server-side_ physics with JavaScript bindings to Bullet
  - Multiplayer support, which plays nicely with the physics server
  - A model loader
  - Positional audio tracking
  - Youtube player
  - VR `bash` shell
  - Everything is JS and hackable

## In progress

  - A menu UI infrastructure
  - Plugin management without leaving VR
  - Voice controls and reading backed by Watson
  - Virtual tools you can pick up and play with
  - Keyboard emulation
  - Emulated game consoles with Retroarch
