# FAQ

**Zeo VR** is a [`node.js`](https://nodejs.org) web server that runs virtual worlds built out of [`npm`](https://npmjs.org) modules.

You can access the VR world from any modern web browser. Most headsets and controllers are supported via [`WebVR`](https://webvr.info/). You don't need a headset, though; there's mouse and keyboard emulation.

Worlds are <i>persistent</i> and <i>multiplayer</i> out of the box, and you can <i>drag and drop</i> and configure <a href="">npm modules</a> to add objects, behaviors, and entire features like physics engines -- without taking off your headset.

You can also write and publish your own modules: it's all Javascript, DOM, `THREE.js`, and `node`. [Read the API docs](#api-docs).

## Install Zeo VR

Install from the Github repository:

```bash
npm install git+ssh://git@github.com/modulesio/zeo.git
```

Note that you will need some dependencies on your system for the build to work. This is mainly for the physics engine, audio streaming, and avatar generation.

### Install depencencies: Ubuntu

```bash
sudo apt-get install build-essential cmake python ffmpeg libcairo2-dev
```

### Install depencencies: Debian

```bash
sudo apt-get install build-essential cmake python libav-tools libcairo2-dev
```

### Install depencencies: Other

You'll almost certainly find the above packages in your operating system's package manager. However, they might be listed under different names.

## Highlights

- Multiplayer out of the box
- Voice chat support
- Worlds persist when you leave
- In-VR module configurator
- Vanilla `DevTools` and `node` development and debugging
- Entity-component system via the DOM
- [THREE.js](https://threejs.org) API
- Use any [`npm`](https://npmjs.org) module
- Run code on the front- and back- end
- Hot module loading
- Normalized DOM event API for headset and controllers
- Per-frame, per-eye render callbacks
- Positional audio API
- First class media file and model uploads
- Support all major model formats
- HMD + controller emulation with keyboard + mouse
- It's all just Javascript
- [Open source on Github](https://github.com/modulesio/zeo)

## Recommended modules

#### z-sp-physics

<iframe width="560" height="315" src="https://www.youtube.com/embed/AOZtqDhQP44" frameborder="0" allowfullscreen></iframe>

#### z-mp-physics

<iframe width="560" height="315" src="https://www.youtube.com/embed/AOZtqDhQP44" frameborder="0" allowfullscreen></iframe>

#### z-paint

<iframe width="560" height="315" src="https://www.youtube.com/embed/AOZtqDhQP44" frameborder="0" allowfullscreen></iframe>

#### z-camera

<iframe width="560" height="315" src="https://www.youtube.com/embed/AOZtqDhQP44" frameborder="0" allowfullscreen></iframe>

#### z-whiteboard

<iframe width="560" height="315" src="https://www.youtube.com/embed/AOZtqDhQP44" frameborder="0" allowfullscreen></iframe>

## Browser requirements

Zeo VR works on every modern web browser. The only hard requirement is [`WebGL`](https://en.wikipedia.org/wiki/WebGL), which is [broadly supported](http://caniuse.com/#feat=webgl).

Note that [`WebVR`](https://webvr.info/) itself is _not_ required, nor do you need VR hardware: there is mouse + keyboard emulation of VR controls (keybindings are [here](#key-bindings)). That said, the main point of Zeo VR is that it works in virtual reality, so you're missing out without a headset. But the option of working without gear is there, and enjoys first-class support.

If you want to use `WebVR`, you'll need a browser that supports it. For desktop, that means either [Chromium Experimental](https://webvr.info/get-chrome/) or [Firefox Nightly](https://www.mozilla.org/en-US/firefox/channel/desktop/#nightly). This requirement will go away when WebVR makes it to to the stable release.

## Server requirements

The main requirement for running your own Zeo VR server is __Linux__.

Technically all you need is `node.js`, but some native C++ modules require a build step and a native C++ compiler.

_Windows_ (via Windows Subsystem for Linux) and _OSX_ might work, but are not tested. It's recommended that you simply use a Linux virtual machine.

## Headset support

Only [HTC Vive](https://en.wikipedia.org/wiki/HTC_Vive) is supported at the moment.

Most other headsets (including mobile platforms like Daydream) _will probably work_ but are not tested.

The main problem you'll run into is that models, tutorials, and documentation assume you're using a Vive. The other potential problem is performance.

Support for more devices is on the roadmap.
