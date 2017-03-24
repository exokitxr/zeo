# User manual

## Getting started

Here's how to get started running your own Zeo VR server.

## Server setup: Docker

The recommended (and easiest) way to run Zeo VR is with [Docker](https://docker.com). That way you won't have to install anything else or worry about versions.

Unless you need to hack Zeo VR itself, this is your best option.

### Step 1: Get Docker

If you don't have Docker yet, follow [these instructions](https://docs.docker.com/engine/getstarted/step_one/).

### Step 2: Pull image

#### Pull modulesio/zeo with docker

```javascript
docker pull modulesio/zeo
```

The [latest Zeo VR image](https://hub.docker.com/r/modulesio/zeo/) is on Docker hub. The build is automated from the Github `master` branch.

To pull the image locally, use `docker pull modulesio/zeo`.

You can repeat this anytime to get the latest Zeo VR image, but note that you will also need to follow the rest of the steps to create a new container for the the image.

### Step 3: Run container

#### Run modulesio/zeo with docker

```javascript
docker run modulesio/zeo
```

Once you have the Zeo VR Docker image, run it with `docker run modulesio/zeo`.

If you did everything right, the autput should be a URL that you can access from your browser.

However, you might also want to (or need to) clean up your configuration to get your browser pointed at the right place and fix browser warnings:

- [Update your /etc/hosts](#step-6-hosts-file-optional)
- [Configure a TLS certificate](#step-7-tls-certificate-optional)

[See here](#command-line) for the command line arguments you can use when starting your container. They're passed through directly to the server start script.

## Server setup: Bare

Here's how to set up Zeo VR on a bare server.

### Step 1: Get Linux

Get yourself a Linux machine.

It can be raw Linux or a virtual machine, but it needs to be Linux. It doesn't matter which distribution.

### Step 2: Get node.js

[Install node.js](https://nodejs.org/en/download/), version `7+`.

You have many options here: install the binaries, use your distribution's package manager, or use [`nvm`](https://github.com/creationix/nvm) (recommended).

### Step 3: Install dependencies

Zeo VR requires some native modules to be built for server-side physics, audio/video processing, and such. These should be built automatically when you `npm install zeo`, but for that to work you'll need a compiler, build system, and a few libraries on your system.

These are:

- `build-essential`
- `cmake`
- `python`
- `ffmpeg`
- `libcairo2-dev`

You'll find these in your package manager of choice.

#### Install dependencies (Ubuntu)

```javascript
sudo apt-get install build-essential cmake python ffmpeg libcairo2-dev
```

#### Install dependencies (Debian)

```javascript
sudo apt-get install build-essential cmake python libav-tools libcairo2-dev
```

### Step 4: Npm install

This one is fairly straightforward. Just make sure there are no build errors.

#### Install zeo module

```javascript
npm install zeo
```

### Step 5: Start server

If everything worked, you should be able to start your server now. The first run will need to generate some stuff like SSL certificates, signing keys, and a server identity (procedurally generated icons and skyboxes), so it might take a minute.

#### Start Zeo VR server

```javascript
./scripts/start.sh
```

Once everything's up and running, you'll get a URL and access token you can use to connect to your server from your browser.

Note that since you're using a self-signed SSL certificate, your browser will complain that the connection is insecure. The fix is to use your own SSL certificate (see below).

[See here](#command-line) for the command line arguments you can use.

#### After a while you should see

```javascript
https://local.zeovr.io:8000?t=ZU1TVgYyUAlDCnJgDVNDRHlrCmhAGDvCgHRhexoD
```

### Step 6: Hosts file (optional)

Since you're running a server on your own domain (`local.zeovr.io`) and you (probably) don't own that domain, you'll need to teach your computer how to reach it.

That is, you'll need to add a line to your [hosts file](https://en.wikipedia.org/wiki/Hosts_(file)).

Once you've done that, you should be able to connect to your server by opening the URL from the previous step in your browser.

```javascript
# /etc/hosts
127.0.0.1 local.zeovr.io
```

### Step 7: TLS certificate (optional)

Zeo VR uses **HTTP/2**, for both security and performance. This requires using a TLS certificate. By default the server will generate a self-signed certificate for a fake domain (`local.zeovr.io`) and use that.

Although this "works", browsers will complain about it, it's insecure, and will impact load performance (due to lack of caching). Unfortunately Zeo VR cannot fix this for you -- that would defeat the point of TLS.

The good news is that if you have a domain, you can easily fix this with a [free TLS certificate from Let's Encrypt](https://certbot.eff.org/). If you don't have a domain, you'll need to either get a domain or accept these caveats.

If you have a certificate, just drop `cert.pem` and `private.pem` it into the `crypto/cert` directory and restart your server with the `serverHost=yourdomain.com` argument. `yourdomain.com` can be any domain covered by your certificate. You can overwrite the self-signed certificate in `crypto/cert`.

#### Place your TLS certificate here

```javascript
./crypto/cert/cert.pem
./crypto/cert/private.pem
```

## Getting help

Found a bug? [File an issue on Github](https://github.com/modulesio/zeo/issues).

Need help? [Reach out on Twitter](https://twitter.com/modulesio).

## Reference

Here are some useful reference pages.

### Command line

// XXX

### Key bindings

Zeo VR works best with a headset, but here are the mouse + keyboard key bindings in case you missed them in the Hub tutorial:

- **WASD** Move around
- **Z or C** Focus left or right controller (_required_ to use the buttons below)
- **Click** Trigger
- **E** Menu
- **F** Grip
- **Q** Touchpad
- **Mousewheel** Move controller x/y axis
- **Ctrl + Mousewheel** Move controller x/z axis
- **Shift + Mousewheel** Rotate controller

### Data directories

XXX
