## Getting started

Short version:

- **Windows**: download [latest release](https://github.com/modulesio/zeo/releases), unzip, and run
- **Linux/OSX**: `npm i -g zeo`, then `zeo`

Long version? Take a seat my friend. &#x1F64F;

## How it works

You run a the VR server on your machine. You connect to that server with your web browser. All you need is the URL (IP and port). If you give that URL to your friends they can connect too.

## System requirements

#### Server

The server just serves files and pipes Websocket data to clients. Expect to serve at least 8 clients on a modern desktop machine.

A more powerful CPU means being able to serve more clients. More memory means being able to load more mods.

#### Client (Mouse + keyboard)

Mouse + keyboard controls should work fine on any modern desktop or laptop, regardless of CPU, memory, or GPU. Much more important than specs is that you have an up-to-date browser.

The most important piece of hardware here is the GPU, which will get you a higher framerate, followed by the CPU, which will help with more complex worlds.

Memory doesn't really matter, unless you have 2GB or less.

#### Client (VR headset)

If you're running a VR headset, your machine definitely meets all requirements.

- *HTC Vive*: supported
- *Oculus Rift*: support planned, might work if you're lucky

#### If you're using Windows

Only `Windows 10` is supported.

1. Download the latest release [here](https://github.com/modulesio/zeo/releases).
1. Unzip the `.zip` file. Windows does that, but you can also use [`7-zip`](http://www.7-zip.org/download.html) or whatever.
1. Double-click `Zeo`, this opens the terminal.
1. Type `start` and hit `Enter`, this starts your server. Might take a moment.
1. You'll see a url like `http://127.0.0.1:8000/`, open that in your web browser.
1. You're in! (hopefully)
1. (Optional) If you just want mouse + keyboard, you're done. If you want to use a VR headset, make sure your browser has [WebVR](https://webvr.info/) and you should see a button to enter VR.

If it worked, [head over to orientation](/docs/orientation) to learn how to control your world like a bawss. &#x1F389;

If it didn't work I'm truly sorry. &x1F622; But I think we can fix this, head over to [Trouble](#Troubleshooting).

#### If you're using Linux/OSX

Pretty much any version of Linux or OSX should work.

1. [Install node.js "current"](https://nodejs.org/en/download/current/). You definitely want "current".
1. Open a terminal window.
1. Type `npm i -g zeo` and press `Enter`. This installs the server.
1. Type `start` and hit `Enter`, this starts your server. Might take a moment.
1. You'll see a url like `http://127.0.0.1:8000/`, open that in your web browser.
1. You're in! (hopefully)
1. (Optional) If you just want mouse + keyboard, you're done. If you want to use a VR headset, make sure your browser has [WebVR](https://webvr.info/) and you should see a button to enter VR.

#### If you know Docker (advanced but recommended)

If you know what this means, you probably know what you're doing. [We have a `Dockerfile`](https://github.com/modulesio/zeo/blob/master/Dockerfile) and that's the recommended way to deploy to your infrastructure. You'll figure it out. &#x1F607;

## Notes

- You need to open up ports `7777`-`7800` for `HTTP` traffic. If other people have trouble connecting to your server, that's probably why, epecially if you're running from home. How you do this is different for every router/internet provider, so you might need to do some digging.

- If you're installing a bunch of mods and you care about security, you should run your server inside a [Docker container](https://docker.com/). [That's 100% supported](https://github.com/modulesio/zeo/blob/master/Dockerfile), but explaining Docker is a whole 'nother discussion &mdash; you'll probably want to [do some reading](https://docs.docker.com/get-started/).

## Troubleshooting

If it didn't work, there could be many reasons why. But we'd love to help you figure it out on:

- [Slack](https://zeovr.slack.com/)
- [Forum](https://zeovr.io/forum/)
- [Email](mailto:support@zeovr.io)
