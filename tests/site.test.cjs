const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeSoundMuralPage } = require("../site.js");

class Element {
  constructor() { this.listeners = {}; this.children = []; this.hidden = false; this.textContent = ""; this.attributes = {}; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  fire(name) { for (const fn of this.listeners[name] || []) fn(); }
  appendChild(child) { this.children.push(child); }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
}
class Video extends Element {
  constructor() { super(); this.paused = true; this.preload = "none"; this.parentElement = new Element(); this.plays = 0; this.loads = 0; this.currentTime = 0; this.duration = 5; this.rect = {top: 1, bottom: 100, left: 1, right: 100}; }
  play() { this.plays++; if (this.playResult) return this.playResult(); this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() { this.loads++; this.paused = true; this.currentTime = 0; }
  getBoundingClientRect() { return this.rect; }
}
function fixture(options = {}) {
  const hero = new Video(), gallery = new Video();
  const ids = {};
  for (const id of ["yr", "animation-toggle", "animation-status", "hero-src", "hero-name", "hero-pack", "copy-launch-email", "launch-email-address", "launch-email-status"]) ids[id] = new Element();
  ids["hero-video"] = hero;
  ids["launch-email-address"].value = "hello@soundmural.com";
  const doc = new Element();
  doc.hidden = false;
  doc.getElementById = id => ids[id];
  doc.createElement = () => new Element();
  doc.querySelectorAll = () => [hero, gallery];
  const classes = new Map();
  doc.documentElement = {classList: {toggle: (key, value) => classes.set(key, value)}};
  const motion = new Element(); motion.matches = !!options.reduced;
  const win = new Element();
  win.matchMedia = () => motion;
  win.innerHeight = 800; win.innerWidth = 1200; win.navigator = {};
  if (!options.noObserver) win.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; win.observer = this; }
    observe() {}
  };
  const show = (video, visible) => win.observer.callback([{target: video, isIntersecting: visible, intersectionRatio: visible ? 1 : 0}]);
  initializeSoundMuralPage(doc, win);
  return {hero, gallery, ids, doc, win, motion, classes, show};
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test("hero and gallery share visibility policy and resume without scrolling", async () => {
  const f = fixture();
  assert.equal(f.hero.plays, 0);
  f.show(f.hero, true); f.show(f.gallery, true); await flush();
  assert.equal(f.hero.plays, 1); assert.equal(f.gallery.plays, 1);
  f.show(f.hero, false);
  assert.equal(f.hero.paused, true);
  f.doc.hidden = true; f.doc.fire("visibilitychange");
  assert.equal(f.gallery.paused, true);
  f.doc.hidden = false; f.doc.fire("visibilitychange"); await flush();
  assert.equal(f.gallery.plays, 2);
  assert.equal(f.hero.plays, 1);
});

test("user pause persists across tab changes and only visible clips resume", async () => {
  const f = fixture();
  f.show(f.hero, true); await flush();
  f.ids["animation-toggle"].fire("click");
  assert.equal(f.hero.paused, true);
  assert.equal(f.classes.get("animations-paused"), true);
  f.doc.hidden = true; f.doc.fire("visibilitychange");
  f.doc.hidden = false; f.doc.fire("visibilitychange");
  assert.equal(f.hero.plays, 1);
  f.ids["animation-toggle"].fire("click"); await flush();
  assert.equal(f.hero.plays, 2);
  assert.equal(f.gallery.plays, 0);
});

test("motion preference changes are live and explicit play can opt in", async () => {
  const f = fixture({reduced: true});
  f.show(f.hero, true); await flush();
  assert.equal(f.hero.plays, 0);
  f.ids["animation-toggle"].fire("click"); await flush();
  assert.equal(f.hero.plays, 1);
  f.motion.fire("change");
  assert.equal(f.hero.paused, true);
  f.motion.matches = false; f.motion.fire("change"); await flush();
  assert.equal(f.hero.plays, 2);
  f.ids["animation-toggle"].fire("click");
  f.motion.matches = true; f.motion.fire("change");
  f.motion.matches = false; f.motion.fire("change");
  assert.equal(f.hero.paused, true, "user pause must survive preference changes");
});

test("refused autoplay exposes a keyboard button and explicit retry works", async () => {
  const f = fixture();
  f.hero.playResult = () => Promise.reject(new Error("NotAllowedError"));
  f.show(f.hero, true); await flush();
  const button = f.hero.parentElement.children[0];
  assert.equal(button.hidden, false);
  assert.equal(button.type, "button");
  f.hero.playResult = null;
  button.fire("click"); await flush();
  assert.equal(button.hidden, true);
  assert.equal(f.hero.paused, false);
});

test("a delayed play result cannot restart a hidden document", async () => {
  const f = fixture();
  let finish;
  f.hero.playResult = () => new Promise(resolve => { finish = () => { f.hero.paused = false; resolve(); }; });
  f.show(f.hero, true);
  f.doc.hidden = true; f.doc.fire("visibilitychange");
  finish(); await flush();
  assert.equal(f.hero.paused, true);
});

test("hero source and poster change together after two actual loops", async () => {
  const f = fixture();
  f.show(f.hero, true); await flush();
  for (let loop = 0; loop < 2; loop++) {
    f.hero.currentTime = 1; f.hero.fire("timeupdate");
    f.hero.currentTime = 0.1; f.hero.fire("timeupdate");
  }
  await flush();
  assert.equal(f.ids["hero-src"].src, "media/hero/cyberspace.mp4");
  assert.equal(f.hero.poster, "media/viz/cyberspace.jpg");
  const fs = require("node:fs"), path = require("node:path");
  assert.ok(fs.existsSync(path.join(__dirname, "..", f.hero.poster)), "rotated poster must exist");
  assert.ok(fs.existsSync(path.join(__dirname, "..", f.ids["hero-src"].src)), "rotated video must exist");
  assert.equal(f.ids["hero-name"].textContent, "Cyberspace");
});

test("fallback viewport checks keep offscreen clips stopped", async () => {
  const f = fixture({noObserver: true});
  await flush();
  f.hero.rect = {top: -200, bottom: -1, left: 0, right: 100};
  f.win.fire("scroll");
  assert.equal(f.hero.paused, true);
  assert.equal(f.gallery.paused, false);
});

test("copy-address success and unavailable clipboard have honest recovery", async () => {
  const f = fixture();
  let copied;
  f.win.navigator.clipboard = {writeText: async value => { copied = value; }};
  f.ids["copy-launch-email"].fire("click"); await flush();
  assert.equal(copied, "hello@soundmural.com");
  assert.ok(f.ids["launch-email-status"].textContent.includes("Send an email"));
  f.win.navigator.clipboard = null;
  f.ids["copy-launch-email"].fire("click");
  assert.equal(f.ids["launch-email-address"].selected, true);
  assert.equal(f.ids["launch-email-address"].focused, true);
});

test("media errors keep a retry control and do not create automatic retry loops", async () => {
  const f = fixture();
  f.show(f.hero, true); await flush();
  f.hero.error = {code: 2}; f.hero.pause(); f.hero.fire("error");
  const button = f.hero.parentElement.children[0];
  assert.equal(button.hidden, false);
  assert.equal(button.textContent, "Retry preview");
  f.doc.fire("visibilitychange"); await flush();
  assert.equal(f.hero.plays, 1);
  f.hero.error = null; button.fire("click"); await flush();
  assert.equal(f.hero.plays, 2);
});
