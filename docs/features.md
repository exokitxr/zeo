# Features

### In-VR world builder

<div style="display: flex; background-color: #CCC; width: 560px; height: 315px; margin: 20px 0; justify-content: center; align-items: center; font-size: 30px; font-weight: 400;">Video goes here</div>

We built this thing from the ground up to work in VR. Whether you're 3D modeling, animating, chatting, or typing text, it's designed to work without you ever taking off your headset. &#x1F60E;

In fact there is no VR-less interface at all. The only way to _not_ use a headset and controllers is to fake them with your mouse and keyboard!

But don't worry, that's fully supported! We even made a tutorial for you to familiarize yourself with controlling your avatar when you're without VR gear. &#x1F50C;

### In-browser multiplayer

Every world automatically supports other avatars joining anytime. Just paste others the URL -- it fits in a tweet. All they need is a browser.

There is of course positioned voice chat support, whether you're using a headset or not. Since it's server based, there's no weird connection stuff to worry about. You can VR-meet with people across continents if you want. &#x1F30E;

And if you're feeling lonesome, you can browse servers and explore other people's worlds. Servers automatically broadcast their presence to share the VR love. &#x1F497;

### Pure Javascript

<img src="https://transfer.sh/16bjNs/nodejs.svg" width=100 height=100>

Time for some geek talk. This crud is built with the world's most popular programming language. &#x1F468;&#x200D;&#x1F4BB;

If you know Javascript you'll feel right at home hacking your world. If you know [THREE.js](https://threejs.org/) then you have nothing to learn.

There's no secrets in the code; it's just a bunch of readable `npm` modules stuck together. To get it running, run

```
npm install modulesio/zeo
```

wherever `node` is found.

### Backend and frontend
### Hotloading
### Unopinionated deploy
### Unopinionated deploy
### Npm in VR
### THREE.js API
### Entity-component system


























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
