! function(e) {
    if ("object" == typeof exports && "undefined" != typeof module) module.exports = e();
    else if ("function" == typeof define && define.amd) define([], e);
    else {
        var t;
        "undefined" != typeof window ? t = window : "undefined" != typeof global ? t = global : "undefined" != typeof self && (t = self), t.msr = e()
    }
}(function() {
    var e;
    return function t(e, i, n) {
        function a(r, d) {
            if (!i[r]) {
                if (!e[r]) {
                    var s = "function" == typeof require && require;
                    if (!d && s) return s(r, !0);
                    if (o) return o(r, !0);
                    var u = new Error("Cannot find module '" + r + "'");
                    throw u.code = "MODULE_NOT_FOUND", u
                }
                var c = i[r] = {
                    exports: {}
                };
                e[r][0].call(c.exports, function(t) {
                    var i = e[r][1][t];
                    return a(i ? i : t)
                }, c, c.exports, t, e, i, n)
            }
            return i[r].exports
        }
        for (var o = "function" == typeof require && require, r = 0; r < n.length; r++) a(n[r]);
        return a
    }({
        1: [function(t, i, n) {
            (function(t) {
                function n(e) {
                    if (!e) throw "MediaStream is mandatory.";
                    this.start = function(i) {
                        var n;
                        "undefined" != typeof MediaRecorder ? n = u : (y || b || w) && (this.mimeType.indexOf("video") !== -1 ? n = h : this.mimeType.indexOf("audio") !== -1 && (n = c)), "image/gif" === this.mimeType && (n = p), "audio/wav" !== this.mimeType && "audio/pcm" !== this.mimeType || (n = c), this.recorderType && (n = this.recorderType), t = new n(e), t.blobs = [];
                        var a = this;
                        t.ondataavailable = function(e) {
                            t.blobs.push(e), a.ondataavailable(e)
                        }, t.onstop = this.onstop, t.onStartedDrawingNonBlankFrames = this.onStartedDrawingNonBlankFrames, t = o(t, this), t.start(i)
                    }, this.onStartedDrawingNonBlankFrames = function() {}, this.clearOldRecordedFrames = function() {
                        t && t.clearOldRecordedFrames()
                    }, this.stop = function() {
                        t && t.stop()
                    }, this.ondataavailable = function(e) {
                        console.log("ondataavailable..", e)
                    }, this.onstop = function(e) {
                        console.warn("stopped..", e)
                    }, this.save = function(e, i) {
                        if (!e) {
                            if (!t) return;
                            return void ConcatenateBlobs(t.blobs, t.blobs[0].type, function(e) {
                                r(e)
                            })
                        }
                        r(e, i)
                    }, this.pause = function() {
                        t && (t.pause(), console.log("Paused recording.", this.mimeType || t.mimeType))
                    }, this.resume = function() {
                        t && (t.resume(), console.log("Resumed recording.", this.mimeType || t.mimeType))
                    }, this.recorderType = null, this.mimeType = "video/webm", this.disableLogs = !1;
                    var t
                }

                function a(e) {
                    if (!e) throw "MediaStream is mandatory.";
                    var t = this,
                        i = s();
                    this.stream = e, this.start = function(s) {
                        function u(e) {
                            d++, t.ondataavailable(e)
                        }
                        a = new n(e), o = new n(e), a.mimeType = "audio/ogg", o.mimeType = "video/webm";
                        for (var c in this) "function" != typeof this[c] && (a[c] = o[c] = this[c]);
                        a.ondataavailable = function(e) {
                            r[d] || (r[d] = {}), r[d].audio = e, r[d].video && !r[d].onDataAvailableEventFired && (r[d].onDataAvailableEventFired = !0, u(r[d]))
                        }, o.ondataavailable = function(e) {
                            return i ? t.ondataavailable({
                                video: e,
                                audio: e
                            }) : (r[d] || (r[d] = {}), r[d].video = e, void(r[d].audio && !r[d].onDataAvailableEventFired && (r[d].onDataAvailableEventFired = !0, u(r[d]))))
                        }, o.onstop = a.onstop = function(e) {
                            t.onstop(e)
                        }, i ? o.start(s) : (o.onStartedDrawingNonBlankFrames = function() {
                            o.clearOldRecordedFrames(), a.start(s)
                        }, o.start(s))
                    }, this.stop = function() {
                        a && a.stop(), o && o.stop()
                    }, this.ondataavailable = function(e) {
                        console.log("ondataavailable..", e)
                    }, this.onstop = function(e) {
                        console.warn("stopped..", e)
                    }, this.pause = function() {
                        a && a.pause(), o && o.pause()
                    }, this.resume = function() {
                        a && a.resume(), o && o.resume()
                    };
                    var a, o, r = {},
                        d = 0
                }

                function o(e, t) {
                    for (var i in t) "function" != typeof t[i] && (e[i] = t[i]);
                    return e
                }

                function r(e, t) {
                    if (!e) throw "Blob object is required.";
                    if (!e.type) try {
                        e.type = "video/webm"
                    } catch (i) {}
                    var n = (e.type || "video/webm").split("/")[1];
                    if (t && t.indexOf(".") !== -1) {
                        var a = t.split(".");
                        t = a[0], n = a[1]
                    }
                    var o = (t || Math.round(9999999999 * Math.random()) + 888888888) + "." + n;
                    if ("undefined" != typeof navigator.msSaveOrOpenBlob) return navigator.msSaveOrOpenBlob(e, o);
                    if ("undefined" != typeof navigator.msSaveBlob) return navigator.msSaveBlob(e, o);
                    var r = document.createElement("a");
                    r.href = g.createObjectURL(e), r.target = "_blank", r.download = o, navigator.mozGetUserMedia && (r.onclick = function() {
                        (document.body || document.documentElement).removeChild(r)
                    }, (document.body || document.documentElement).appendChild(r));
                    var d = new MouseEvent("click", {
                        view: window,
                        bubbles: !0,
                        cancelable: !0
                    });
                    r.dispatchEvent(d), navigator.mozGetUserMedia || g.revokeObjectURL(r.href)
                }

                function d(e) {
                    var t = 1e3,
                        i = ["Bytes", "KB", "MB", "GB", "TB"];
                    if (0 === e) return "0 Bytes";
                    var n = parseInt(Math.floor(Math.log(e) / Math.log(t)), 10);
                    return (e / Math.pow(t, n)).toPrecision(3) + " " + i[n]
                }

                function s() {
                    var e = !!window.opera || navigator.userAgent.indexOf(" OPR/") >= 0,
                        t = !!window.chrome && !e,
                        i = "undefined" != typeof window.InstallTrigger;
                    if (i) return !0;
                    if (!t) return !1;
                    var n, a, o = (navigator.appVersion, navigator.userAgent),
                        r = "" + parseFloat(navigator.appVersion),
                        d = parseInt(navigator.appVersion, 10);
                    return t && (n = o.indexOf("Chrome"), r = o.substring(n + 7)), (a = r.indexOf(";")) !== -1 && (r = r.substring(0, a)), (a = r.indexOf(" ")) !== -1 && (r = r.substring(0, a)), d = parseInt("" + r, 10), isNaN(d) && (r = "" + parseFloat(navigator.appVersion), d = parseInt(navigator.appVersion, 10)), d >= 49
                }

                function u(e) {
                    function t() {
                        if ("active" in e) {
                            if (!e.active) return !1
                        } else if ("ended" in e && e.ended) return !1;
                        return !0
                    }
                    var i = this;
                    this.start = function(t, a) {
                        if (i.mimeType || (i.mimeType = "video/webm"), i.mimeType.indexOf("audio") !== -1 && e.getVideoTracks().length && e.getAudioTracks().length) {
                            var o;
                            navigator.mozGetUserMedia ? (o = new A, o.addTrack(e.getAudioTracks()[0])) : o = new A(e.getAudioTracks()), e = o
                        }
                        i.mimeType.indexOf("audio") !== -1 && (i.mimeType = y ? "audio/webm" : "audio/ogg"), i.dontFireOnDataAvailableEvent = !1;
                        var r = {
                            mimeType: i.mimeType
                        };
                        i.disableLogs || a || console.log("Passing following params over MediaRecorder API.", r), n && (n = null), y && !s() && (r = "video/vp8");
                        try {
                            n = new MediaRecorder(e, r)
                        } catch (d) {
                            n = new MediaRecorder(e)
                        }
                        "canRecordMimeType" in n && n.canRecordMimeType(i.mimeType) === !1 && (i.disableLogs || console.warn("MediaRecorder API seems unable to record mimeType:", i.mimeType)), n.ignoreMutedMedia = i.ignoreMutedMedia || !1;
                        var u = !1;
                        n.ondataavailable = function(e) {
                            if (!i.dontFireOnDataAvailableEvent && e.data && e.data.size && !(e.data.size < 26800) && !u) {
                                u = !0;
                                var a = i.getNativeBlob ? e.data : new Blob([e.data], {
                                    type: i.mimeType || "video/webm"
                                });
                                i.ondataavailable(a), i.dontFireOnDataAvailableEvent = !0, n && (n.stop(), n = null), i.start(t, "__disableLogs")
                            }
                        }, n.onerror = function(e) {
                            i.disableLogs || ("InvalidState" === e.name ? console.error("The MediaRecorder is not in a state in which the proposed operation is allowed to be executed.") : "OutOfMemory" === e.name ? console.error("The UA has exhaused the available memory. User agents SHOULD provide as much additional information as possible in the message attribute.") : "IllegalStreamModification" === e.name ? console.error("A modification to the stream has occurred that makes it impossible to continue recording. An example would be the addition of a Track while recording is occurring. User agents SHOULD provide as much additional information as possible in the message attribute.") : "OtherRecordingError" === e.name ? console.error("Used for an fatal error other than those listed above. User agents SHOULD provide as much additional information as possible in the message attribute.") : "GenericError" === e.name ? console.error("The UA cannot provide the codec or recording option that has been requested.", e) : console.error("MediaRecorder Error", e)), n && "inactive" !== n.state && "stopped" !== n.state && n.stop()
                        };
                        try {
                            n.start(36e5)
                        } catch (d) {
                            n = null
                        }
                        setTimeout(function() {
                            n && "recording" === n.state && n.requestData()
                        }, t)
                    }, this.stop = function(e) {
                        n && "recording" === n.state && (n.requestData(), setTimeout(function() {
                            i.dontFireOnDataAvailableEvent = !0, n && "recording" === n.state && n.stop(), n = null
                        }, 2e3))
                    }, this.pause = function() {
                        n && "recording" === n.state && n.pause()
                    }, this.ondataavailable = function(e) {
                        console.log("recorded-blob", e)
                    }, this.resume = function() {
                        if (this.dontFireOnDataAvailableEvent) {
                            this.dontFireOnDataAvailableEvent = !1;
                            var e = i.disableLogs;
                            return i.disableLogs = !0, this.record(), void(i.disableLogs = e)
                        }
                        n && "paused" === n.state && n.resume()
                    }, this.clearRecordedData = function() {
                        n && (this.pause(), this.dontFireOnDataAvailableEvent = !0, this.stop())
                    };
                    var n;
                    ! function a() {
                        if (n) return t() === !1 ? void i.stop() : void setTimeout(a, 1e3)
                    }()
                }

                function c(e) {
                    this.start = function(n) {
                        n = n || 1e3, t = new f(e, this), t.record(), i = setInterval(function() {
                            t.requestData()
                        }, n)
                    }, this.stop = function() {
                        t && (t.stop(), clearTimeout(i))
                    }, this.pause = function() {
                        t && t.pause()
                    }, this.resume = function() {
                        t && t.resume()
                    }, this.ondataavailable = function() {};
                    var t, i
                }

                function f(e, t) {
                    function i(e, t) {
                        for (var i = e.length + t.length, n = new Float32Array(i), a = 0, o = 0; o < i;) n[o++] = e[a], n[o++] = t[a], a++;
                        return n
                    }

                    function n(e, t) {
                        for (var i = new Float32Array(t), n = 0, a = e.length, o = 0; o < a; o++) {
                            var r = e[o];
                            i.set(r, n), n += r.length
                        }
                        return i
                    }

                    function a(e, t, i) {
                        for (var n = i.length, a = 0; a < n; a++) e.setUint8(t + a, i.charCodeAt(a))
                    }

                    function o(e) {
                        for (var t = e.length, i = new Int16Array(t); t--;) i[t] = 65535 * e[t];
                        return i.buffer
                    }
                    var r = 44100;
                    T.AudioContextConstructor || (T.AudioContextConstructor = new T.AudioContext), r = T.AudioContextConstructor.sampleRate;
                    var s, u, c, f, h = [],
                        l = [],
                        p = !1,
                        m = 0,
                        v = t.sampleRate || r,
                        g = t.mimeType || "audio/wav",
                        w = g.indexOf("audio/pcm") > -1,
                        b = t.audioChannels || 2;
                    this.record = function() {
                        p = !0, h.length = l.length = 0, m = 0
                    }, this.requestData = function() {
                        if (!M) {
                            if (0 === m) return void(A = !1);
                            A = !0;
                            var e = h.slice(0),
                                r = l.slice(0),
                                s = m;
                            h.length = l.length = [], m = 0, A = !1;
                            var u = n(e, s),
                                c = u;
                            if (2 === b) {
                                var f = n(r, s);
                                c = i(u, f)
                            }
                            if (w) {
                                var p = new Blob([o(c)], {
                                    type: "audio/pcm"
                                });
                                return void t.ondataavailable(p)
                            }
                            var g = new ArrayBuffer(44 + 2 * c.length),
                                y = new DataView(g);
                            a(y, 0, "RIFF"), y.setUint32(4, 44 + 2 * c.length - 8, !0), a(y, 8, "WAVE"), a(y, 12, "fmt "), y.setUint32(16, 16, !0), y.setUint16(20, 1, !0), y.setUint16(22, b, !0), y.setUint32(24, v, !0), y.setUint32(28, v * b * 2, !0), y.setUint16(32, 2 * b, !0), y.setUint16(34, 16, !0), a(y, 36, "data"), y.setUint32(40, 2 * c.length, !0);
                            for (var T = c.length, k = 44, O = 1, U = 0; U < T; U++) y.setInt16(k, c[U] * (32767 * O), !0), k += 2;
                            var p = new Blob([y], {
                                type: "audio/wav"
                            });
                            t.ondataavailable(p)
                        }
                    }, this.stop = function() {
                        p = !1, this.requestData(), c.disconnect()
                    };
                    var f = T.AudioContextConstructor;
                    T.VolumeGainNode = f.createGain();
                    var u = T.VolumeGainNode;
                    T.AudioInput = f.createMediaStreamSource(e);
                    var c = T.AudioInput;
                    c.connect(u);
                    var y = t.bufferSize || 2048;
                    if (0 === t.bufferSize && (y = 0), f.createJavaScriptNode) s = f.createJavaScriptNode(y, b, b);
                    else {
                        if (!f.createScriptProcessor) throw "WebAudio API has no support on this browser.";
                        s = f.createScriptProcessor(y, b, b)
                    }
                    y = s.bufferSize, undefined;
                    var A = !1;
                    window.scriptprocessornode = s, 1 === b && undefined;
                    var M = !1;
                    this.pause = function() {
                        M = !0
                    }, this.resume = function() {
                        M = !1
                    }, s.onaudioprocess = function(e) {
                        if (p && !A && !M) {
                            var t = e.inputBuffer.getChannelData(0);
                            if (h.push(new Float32Array(t)), 2 === b) {
                                var i = e.inputBuffer.getChannelData(1);
                                l.push(new Float32Array(i))
                            }
                            m += y
                        }
                    }, u.connect(s), s.connect(f.destination)
                }

                function h(e) {
                    this.start = function(n) {
                        n = n || 1e3, t = new l(e, this);
                        for (var a in this) "function" != typeof this[a] && (t[a] = this[a]);
                        t.record(), i = setInterval(function() {
                            t.requestData()
                        }, n)
                    }, this.stop = function() {
                        t && (t.stop(), clearTimeout(i))
                    }, this.clearOldRecordedFrames = function() {
                        t && t.clearOldRecordedFrames()
                    }, this.pause = function() {
                        t && t.pause()
                    }, this.resume = function() {
                        t && t.resume()
                    }, this.ondataavailable = function() {};
                    var t, i
                }

                function l(e, t) {
                    function i() {
                        if (m) return c = (new Date).getTime(), void setTimeout(i, 500);
                        if (!s) {
                            if (o) return setTimeout(i, 100);
                            var e = (new Date).getTime() - c;
                            if (!e) return i();
                            c = (new Date).getTime(), !p.isHTMLObject && u.paused && u.play(), l.drawImage(u, 0, 0, h.width, h.height), s || f.frames.push({
                                duration: e,
                                image: h.toDataURL("image/webp")
                            }), r || n(f.frames[f.frames.length - 1]) || (r = !0, t.onStartedDrawingNonBlankFrames()), setTimeout(i, 10)
                        }
                    }

                    function n(e, t, i) {
                        var n = document.createElement("canvas");
                        n.width = h.width, n.height = h.height;
                        var a, o, r, d = n.getContext("2d"),
                            s = {
                                r: 0,
                                g: 0,
                                b: 0
                            },
                            u = Math.sqrt(Math.pow(255, 2) + Math.pow(255, 2) + Math.pow(255, 2)),
                            c = t && t >= 0 && t <= 1 ? t : 0,
                            f = i && i >= 0 && i <= 1 ? i : 0,
                            l = new Image;
                        l.src = e.image, d.drawImage(l, 0, 0, h.width, h.height);
                        var p = d.getImageData(0, 0, h.width, h.height);
                        a = 0, o = p.data.length, r = p.data.length / 4;
                        for (var m = 0; m < o; m += 4) {
                            var v = {
                                    r: p.data[m],
                                    g: p.data[m + 1],
                                    b: p.data[m + 2]
                                },
                                g = Math.sqrt(Math.pow(v.r - s.r, 2) + Math.pow(v.g - s.g, 2) + Math.pow(v.b - s.b, 2));
                            g <= u * c && a++
                        }
                        return !(r - a <= r * f)
                    }

                    function a(e, t, i, n) {
                        var a = document.createElement("canvas");
                        a.width = h.width, a.height = h.height;
                        for (var o = a.getContext("2d"), r = [], d = t === -1, s = t && t > 0 && t <= e.length ? t : e.length, u = {
                                r: 0,
                                g: 0,
                                b: 0
                            }, c = Math.sqrt(Math.pow(255, 2) + Math.pow(255, 2) + Math.pow(255, 2)), f = i && i >= 0 && i <= 1 ? i : 0, l = n && n >= 0 && n <= 1 ? n : 0, p = !1, m = 0; m < s; m++) {
                            var v, g, w;
                            if (!p) {
                                var b = new Image;
                                b.src = e[m].image, o.drawImage(b, 0, 0, h.width, h.height);
                                var y = o.getImageData(0, 0, h.width, h.height);
                                v = 0, g = y.data.length, w = y.data.length / 4;
                                for (var A = 0; A < g; A += 4) {
                                    var T = {
                                            r: y.data[A],
                                            g: y.data[A + 1],
                                            b: y.data[A + 2]
                                        },
                                        M = Math.sqrt(Math.pow(T.r - u.r, 2) + Math.pow(T.g - u.g, 2) + Math.pow(T.b - u.b, 2));
                                    M <= c * f && v++
                                }
                            }!p && w - v <= w * l || (d && (p = !0), r.push(e[m]))
                        }
                        return r = r.concat(e.slice(s)), r.length <= 0 && r.push(e[e.length - 1]), r
                    }
                    this.record = function(n) {
                        this.width || (this.width = 320), this.height || (this.height = 240), this.video && this.video instanceof HTMLVideoElement && (this.width || (this.width = u.videoWidth || u.clientWidth || 320), this.height || (this.height = u.videoHeight || u.clientHeight || 240)), this.video || (this.video = {
                            width: this.width,
                            height: this.height
                        }), this.canvas && this.canvas.width && this.canvas.height || (this.canvas = {
                            width: this.width,
                            height: this.height
                        }), h.width = this.canvas.width, h.height = this.canvas.height, this.video && this.video instanceof HTMLVideoElement ? (this.isHTMLObject = !0, u = this.video.cloneNode()) : (u = document.createElement("video"), u.src = g.createObjectURL(e), u.width = this.video.width, u.height = this.video.height), u.muted = !0, u.play(), c = (new Date).getTime(), f = new M.Video(t.speed, t.quality), console.log("canvas resolutions", h.width, "*", h.height), console.log("video width/height", u.width || h.width, "*", u.height || h.height), i()
                    }, this.clearOldRecordedFrames = function() {
                        f.frames = []
                    };
                    var o = !1;
                    this.requestData = function() {
                        if (!m) {
                            if (!f.frames.length) return void(o = !1);
                            o = !0;
                            var e = f.frames.slice(0);
                            f.frames = a(e, -1), f.compile(function(e) {
                                t.ondataavailable(e), undefined
                            }), f.frames = [], o = !1
                        }
                    };
                    var r = !1,
                        s = !1;
                    this.stop = function() {
                        s = !0, this.requestData()
                    };
                    var u, c, f, h = document.createElement("canvas"),
                        l = h.getContext("2d"),
                        p = this,
                        m = !1;
                    this.pause = function() {
                        m = !0
                    }, this.resume = function() {
                        m = !1
                    }
                }

                function p(e) {
                    function t() {
                        s = Date.now();
                        var e = new Blob([new Uint8Array(c.stream().bin)], {
                            type: "image/gif"
                        });
                        n.ondataavailable(e), c.stream().bin = []
                    }
                    if ("undefined" == typeof GIFEncoder) throw "Please link: https://cdn.webrtc-experiment.com/gif-recorder.js";
                    this.start = function(e) {
                        function n(e) {
                            return i ? void setTimeout(n, 500, e) : (h = requestAnimationFrame(n), void 0 === typeof u && (u = e), void(e - u < 90 || (r.paused && r.play(), o.drawImage(r, 0, 0, s, l), c.addFrame(o), u = e)))
                        }
                        e = e || 1e3;
                        var s = this.videoWidth || 320,
                            l = this.videoHeight || 240;
                        a.width = r.width = s, a.height = r.height = l, c = new GIFEncoder, c.setRepeat(0), c.setDelay(this.frameRate || this.speed || 200), c.setQuality(this.quality || 1), c.start(), d = Date.now(), h = requestAnimationFrame(n), f = setTimeout(t, e)
                    }, this.stop = function() {
                        h && (cancelAnimationFrame(h), clearTimeout(f), t())
                    };
                    var i = !1;
                    this.pause = function() {
                        i = !0
                    }, this.resume = function() {
                        i = !1
                    }, this.ondataavailable = function() {}, this.onstop = function() {};
                    var n = this,
                        a = document.createElement("canvas"),
                        o = a.getContext("2d"),
                        r = document.createElement("video");
                    r.muted = !0, r.autoplay = !0, r.src = g.createObjectURL(e), r.play();
                    var d, s, u, c, f, h = null
                }
                "undefined" != typeof n && (n.MultiStreamRecorder = a);
                var m = "Fake/5.0 (FakeOS) AppleWebKit/123 (KHTML, like Gecko) Fake/12.3.4567.89 Fake/123.45";
                ! function(e) {
                    "undefined" == typeof window && ("undefined" == typeof window && "undefined" != typeof t ? (t.navigator = {
                        userAgent: m,
                        getUserMedia: function() {}
                    }, e.window = t) : "undefined" == typeof window, "undefined" == typeof document && (e.document = {}, document.createElement = document.captureStream = document.mozCaptureStream = function() {
                        return {}
                    }), "undefined" == typeof location && (e.location = {
                        protocol: "file:",
                        href: "",
                        hash: ""
                    }), "undefined" == typeof screen && (e.screen = {
                        width: 0,
                        height: 0
                    }))
                }("undefined" != typeof t ? t : window);
                var v = window.AudioContext;
                "undefined" == typeof v && ("undefined" != typeof webkitAudioContext && (v = webkitAudioContext), "undefined" != typeof mozAudioContext && (v = mozAudioContext)), "undefined" == typeof window && (window = {});
                var v = window.AudioContext;
                "undefined" == typeof v && ("undefined" != typeof webkitAudioContext && (v = webkitAudioContext), "undefined" != typeof mozAudioContext && (v = mozAudioContext));
                var g = window.URL;
                "undefined" == typeof g && "undefined" != typeof webkitURL && (g = webkitURL), "undefined" != typeof navigator ? ("undefined" != typeof navigator.webkitGetUserMedia && (navigator.getUserMedia = navigator.webkitGetUserMedia), "undefined" != typeof navigator.mozGetUserMedia && (navigator.getUserMedia = navigator.mozGetUserMedia)) : navigator = {
                    getUserMedia: function() {},
                    userAgent: m
                };
                var w = !(navigator.userAgent.indexOf("Edge") === -1 || !navigator.msSaveBlob && !navigator.msSaveOrOpenBlob),
                    b = !1;
                "undefined" != typeof opera && navigator.userAgent && navigator.userAgent.indexOf("OPR/") !== -1 && (b = !0);
                var y = !w && !w && !!navigator.webkitGetUserMedia,
                    A = window.MediaStream;
                "undefined" == typeof A && "undefined" != typeof webkitMediaStream && (A = webkitMediaStream), "undefined" != typeof A && ("getVideoTracks" in A.prototype || (A.prototype.getVideoTracks = function() {
                    if (!this.getTracks) return [];
                    var e = [];
                    return this.getTracks.forEach(function(t) {
                        t.kind.toString().indexOf("video") !== -1 && e.push(t)
                    }), e
                }, A.prototype.getAudioTracks = function() {
                    if (!this.getTracks) return [];
                    var e = [];
                    return this.getTracks.forEach(function(t) {
                        t.kind.toString().indexOf("audio") !== -1 && e.push(t)
                    }), e
                }), "stop" in A.prototype || (A.prototype.stop = function() {
                    this.getAudioTracks().forEach(function(e) {
                        e.stop && e.stop()
                    }), this.getVideoTracks().forEach(function(e) {
                        e.stop && e.stop()
                    })
                })), "undefined" != typeof location && 0 === location.href.indexOf("file:") && console.error("Please load this HTML file on HTTP or HTTPS.");
                var T = {
                        AudioContext: v
                    },
                    T = {
                        AudioContext: window.AudioContext || window.webkitAudioContext
                    };
                "undefined" != typeof n && (n.MediaRecorderWrapper = u), "undefined" != typeof n && (n.StereoAudioRecorder = c), "undefined" != typeof n && (n.StereoAudioRecorderHelper = f), "undefined" != typeof n && (n.WhammyRecorder = h), "undefined" != typeof n && (n.WhammyRecorderHelper = l), "undefined" != typeof n && (n.GifRecorder = p);
                var M = function() {
                    function e(e, t) {
                        this.frames = [], e || (e = 1), this.duration = 1e3 / e, this.quality = t || .8
                    }

                    function t(e) {
                        var t = g.createObjectURL(new Blob([e.toString(), "this.onmessage =  function (e) {" + e.name + "(e.data);}"], {
                                type: "application/javascript"
                            })),
                            i = new Worker(t);
                        return g.revokeObjectURL(t), i
                    }

                    function i(e) {
                        function t(e) {
                            var t = n(e);
                            if (!t) return [];
                            for (var a = 3e4, o = [{
                                    id: 440786851,
                                    data: [{
                                        data: 1,
                                        id: 17030
                                    }, {
                                        data: 1,
                                        id: 17143
                                    }, {
                                        data: 4,
                                        id: 17138
                                    }, {
                                        data: 8,
                                        id: 17139
                                    }, {
                                        data: "webm",
                                        id: 17026
                                    }, {
                                        data: 2,
                                        id: 17031
                                    }, {
                                        data: 2,
                                        id: 17029
                                    }]
                                }, {
                                    id: 408125543,
                                    data: [{
                                        id: 357149030,
                                        data: [{
                                            data: 1e6,
                                            id: 2807729
                                        }, {
                                            data: "whammy",
                                            id: 19840
                                        }, {
                                            data: "whammy",
                                            id: 22337
                                        }, {
                                            data: h(t.duration),
                                            id: 17545
                                        }]
                                    }, {
                                        id: 374648427,
                                        data: [{
                                            id: 174,
                                            data: [{
                                                data: 1,
                                                id: 215
                                            }, {
                                                data: 1,
                                                id: 29637
                                            }, {
                                                data: 0,
                                                id: 156
                                            }, {
                                                data: "und",
                                                id: 2274716
                                            }, {
                                                data: "V_VP8",
                                                id: 134
                                            }, {
                                                data: "VP8",
                                                id: 2459272
                                            }, {
                                                data: 1,
                                                id: 131
                                            }, {
                                                id: 224,
                                                data: [{
                                                    data: t.width,
                                                    id: 176
                                                }, {
                                                    data: t.height,
                                                    id: 186
                                                }]
                                            }]
                                        }]
                                    }]
                                }], r = 0, s = 0; r < e.length;) {
                                var u = [],
                                    c = 0;
                                do u.push(e[r]), c += e[r].duration, r++; while (r < e.length && c < a);
                                var f = 0,
                                    l = {
                                        id: 524531317,
                                        data: i(s, f, u)
                                    };
                                o[1].data.push(l), s += c
                            }
                            return d(o)
                        }

                        function i(e, t, i) {
                            return [{
                                data: e,
                                id: 231
                            }].concat(i.map(function(e) {
                                var i = s({
                                    discardable: 0,
                                    frame: e.data.slice(4),
                                    invisible: 0,
                                    keyframe: 1,
                                    lacing: 0,
                                    trackNum: 1,
                                    timecode: Math.round(t)
                                });
                                return t += e.duration, {
                                    data: i,
                                    id: 163
                                }
                            }))
                        }

                        function n(e) {
                            if (!e[0]) return void postMessage({
                                error: "Something went wrong. Maybe WebP format is not supported in the current browser."
                            });
                            for (var t = e[0].width, i = e[0].height, n = e[0].duration, a = 1; a < e.length; a++) n += e[a].duration;
                            return {
                                duration: n,
                                width: t,
                                height: i
                            }
                        }

                        function a(e) {
                            for (var t = []; e > 0;) t.push(255 & e), e >>= 8;
                            return new Uint8Array(t.reverse())
                        }

                        function o(e) {
                            return new Uint8Array(e.split("").map(function(e) {
                                return e.charCodeAt(0)
                            }))
                        }

                        function r(e) {
                            var t = [],
                                i = e.length % 8 ? new Array(9 - e.length % 8).join("0") : "";
                            e = i + e;
                            for (var n = 0; n < e.length; n += 8) t.push(parseInt(e.substr(n, 8), 2));
                            return new Uint8Array(t)
                        }

                        function d(e) {
                            for (var t = [], i = 0; i < e.length; i++) {
                                var n = e[i].data;
                                "object" == typeof n && (n = d(n)), "number" == typeof n && (n = r(n.toString(2))), "string" == typeof n && (n = o(n));
                                var s = n.size || n.byteLength || n.length,
                                    u = Math.ceil(Math.ceil(Math.log(s) / Math.log(2)) / 8),
                                    c = s.toString(2),
                                    f = new Array(7 * u + 7 + 1 - c.length).join("0") + c,
                                    h = new Array(u).join("0") + "1" + f;
                                t.push(a(e[i].id)), t.push(r(h)), t.push(n)
                            }
                            return new Blob(t, {
                                type: "video/webm"
                            })
                        }

                        function s(e) {
                            var t = 0;
                            if (e.keyframe && (t |= 128), e.invisible && (t |= 8), e.lacing && (t |= e.lacing << 1), e.discardable && (t |= 1), e.trackNum > 127) throw "TrackNumber > 127 not supported";
                            var i = [128 | e.trackNum, e.timecode >> 8, 255 & e.timecode, t].map(function(e) {
                                return String.fromCharCode(e)
                            }).join("") + e.frame;
                            return i
                        }

                        function u(e) {
                            for (var t = e.RIFF[0].WEBP[0], i = t.indexOf("Â*"), n = 0, a = []; n < 4; n++) a[n] = t.charCodeAt(i + 3 + n);
                            var o, r, d;
                            return d = a[1] << 8 | a[0], o = 16383 & d, d = a[3] << 8 | a[2], r = 16383 & d, {
                                width: o,
                                height: r,
                                data: t,
                                riff: e
                            }
                        }

                        function c(e, t) {
                            return parseInt(e.substr(t + 4, 4).split("").map(function(e) {
                                var t = e.charCodeAt(0).toString(2);
                                return new Array(8 - t.length + 1).join("0") + t
                            }).join(""), 2)
                        }

                        function f(e) {
                            for (var t = 0, i = {}; t < e.length;) {
                                var n = e.substr(t, 4),
                                    a = c(e, t),
                                    o = e.substr(t + 4 + 4, a);
                                t += 8 + a, i[n] = i[n] || [], "RIFF" === n || "LIST" === n ? i[n].push(f(o)) : i[n].push(o)
                            }
                            return i
                        }

                        function h(e) {
                            return [].slice.call(new Uint8Array(new Float64Array([e]).buffer), 0).map(function(e) {
                                return String.fromCharCode(e)
                            }).reverse().join("")
                        }
                        var l = new t(e.map(function(e) {
                            var t = u(f(atob(e.image.slice(23))));
                            return t.duration = e.duration, t
                        }));
                        postMessage(l)
                    }
                    return e.prototype.add = function(e, t) {
                        if ("canvas" in e && (e = e.canvas), "toDataURL" in e && (e = e.toDataURL("image/webp", this.quality)), !/^data:image\/webp;base64,/gi.test(e)) throw "Input must be formatted properly as a base64 encoded DataURI of type image/webp";
                        this.frames.push({
                            image: e,
                            duration: t || this.duration
                        })
                    }, e.prototype.compile = function(e) {
                        var n = t(i);
                        n.onmessage = function(t) {
                            return t.data.error ? void console.error(t.data.error) : void e(t.data)
                        }, n.postMessage(this.frames)
                    }, {
                        Video: e
                    }
                }();
                "undefined" != typeof n && (n.Whammy = M),
                    function() {
                        window.ConcatenateBlobs = function(e, t, i) {
                            function n() {
                                if (!e[r]) return a();
                                var t = new FileReader;
                                t.onload = function(e) {
                                    o.push(e.target.result), r++, n()
                                }, t.readAsArrayBuffer(e[r])
                            }

                            function a() {
                                var e = 0;
                                o.forEach(function(t) {
                                    e += t.byteLength
                                });
                                var n = new Uint16Array(e),
                                    a = 0;
                                o.forEach(function(e) {
                                    var t = e.byteLength;
                                    t % 2 != 0 && (e = e.slice(0, t - 1)), n.set(new Uint16Array(e), a), a += t
                                });
                                var r = new Blob([n.buffer], {
                                    type: t
                                });
                                i(r)
                            }
                            var o = [],
                                r = 0;
                            n()
                        }
                    }(), "undefined" != typeof i && (i.exports = n), "function" == typeof e && e.amd && e("MediaStreamRecorder", [], function() {
                        return n
                    })
            }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {})
        }, {}]
    }, {}, [1])(1)
});
