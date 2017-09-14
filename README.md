<p align="center"><img src="https://cdn.rawgit.com/modulesio/zeo/398039c9/public/img/logo-name.svg" width="200px"></p>

**Multiplayer WebVR worlds, procedurally generated with hotloaded `npm` modules.**


🌱🌳🌋🌲🐦🏃🎮

:warning: _Alpha. Getting ready for [Steam](http://steampowered.com/) release. If you can't wait, [join us on Slack](zeovr.slack.com) or [add your email here](http://eepurl.com/cDEnID)._ :warning:

## Overview

Plugins run on both frontend and backend, so they can do pretty much anything. Voxel-based world builder loaded by default.

Mouse + keyboard emulation; only requirement is a modern browser -- but it's more awesome with a headset.

Avatars and items persist across servers on a globally distributed blockchain. Buy, sell, trade, and _own_ your items, skins and plugins.

Plugin API is plain [hotloaded](https://github.com/modulesio/archae/) [THREE.js](https://github.com/mrdoob/three.js/). Supports the usual position tracking, controller events, multiplayer avatars tracking, configurator menu rendering, positional audio, asset loader, and more. Normalized to work the same regardless of headset (or lack thereof).

## Getting started

#### Node

```
npm i modulesio/zeo
cd node_modules/zeo
./scripts/standalone.sh
```

#### Docker

```
docker run -p 8000:8000 modulesio/zeo
```

#### Windows

[Download latest release](https://ci.appveyor.com/project/modulesio/zeo/build/artifacts)

#### Cloud

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

#### Steam release

_Coming soon_ 🦄

## Plugins

- Procedural terrain w/ marching cubes
- Block building with tesselated meshes
- Voxel lighting system
- Avatar skins, compatible with Minecraft format
- Sword, bow, pickaxe
- Console emulation via RetroArch
- Tons more

## Contact

[Slack](zeovr.slack.com) • [Wiki](zeovr.wikia.com) • [Twitter](https://twitter.com/modulesio) • [Email](mailto:a@modules.io)
