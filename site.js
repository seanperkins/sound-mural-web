/* Video playback policy shared by the hero and gallery. */
function initializeSoundMuralPage(doc, win) {
  "use strict";
  var yr = doc.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();
  var motion = win.matchMedia ? win.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var userPaused = false, motionOverride = false;
  var toggle = doc.getElementById("animation-toggle");
  var status = doc.getElementById("animation-status");
  var videos = Array.prototype.slice.call(doc.querySelectorAll("video"));
  var records = new Map();

  function allowed() { return !userPaused && (!motion.matches || motionOverride); }
  function shouldPlay(record) { return allowed() && !doc.hidden && record.visible; }
  function sync(record) {
    var video = record.video;
    if (!shouldPlay(record)) {
      record.epoch++;
      record.pending = false;
      video.pause();
      record.button.hidden = true;
      return;
    }
    record.button.hidden = !record.blocked;
    if (record.blocked || record.pending || !video.paused) return;
    if (video.preload === "none") { video.preload = "metadata"; video.load(); }
    var epoch = ++record.epoch;
    record.pending = true;
    var result;
    try { result = video.play(); } catch (error) { result = Promise.reject(error); }
    Promise.resolve(result).then(function() {
      if (epoch !== record.epoch) {
        if (!shouldPlay(record)) video.pause();
        return;
      }
      record.pending = false;
      record.button.hidden = true;
    }, function() {
      if (epoch !== record.epoch) return;
      record.pending = false;
      record.blocked = true;
      record.button.hidden = !shouldPlay(record);
    });
  }
  function reconcile() {
    if (toggle) {
      toggle.hidden = false;
      toggle.textContent = allowed() ? "Pause animations" : "Play animations";
    }
    if (status) status.textContent = allowed() ? "Animations enabled." : "Animations paused.";
    doc.documentElement.classList.toggle("animations-paused", !allowed());
    records.forEach(sync);
  }

  videos.forEach(function(video) {
    var button = doc.createElement("button");
    button.type = "button";
    button.className = "video-play";
    button.textContent = "Play preview";
    button.setAttribute("aria-label", "Play visualization preview");
    button.hidden = true;
    video.parentElement.appendChild(button);
    var record = { video: video, button: button, visible: false, blocked: false, pending: false, epoch: 0 };
    records.set(video, record);
    button.addEventListener("click", function() {
      userPaused = false;
      motionOverride = motion.matches;
      record.blocked = false;
      record.pending = false;
      record.epoch++;
      // Explicit interaction also retries a failed load, preserving its poster.
      if (video.error) video.load();
      reconcile();
    });
    video.addEventListener("error", function() {
      record.pending = false;
      record.blocked = true;
      record.button.textContent = "Retry preview";
      record.button.setAttribute("aria-label", "Retry visualization preview");
      record.button.hidden = !shouldPlay(record);
    });
  });

  if ("IntersectionObserver" in win) {
    var observer = new win.IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var record = records.get(entry.target);
        record.visible = entry.isIntersecting && entry.intersectionRatio > 0;
        sync(record);
      });
    }, { rootMargin: "0px", threshold: 0 });
    videos.forEach(function(video) { observer.observe(video); });
  } else {
    // Keep offscreen videos stopped even in browsers without the observer.
    var checkViewport = function() {
      records.forEach(function(record) {
        var rect = record.video.getBoundingClientRect();
        record.visible = rect.bottom > 0 && rect.top < win.innerHeight &&
          rect.right > 0 && rect.left < win.innerWidth;
      });
      reconcile();
    };
    win.addEventListener("scroll", checkViewport, { passive: true });
    win.addEventListener("resize", checkViewport);
    checkViewport();
  }
  doc.addEventListener("visibilitychange", reconcile);
  if (toggle) toggle.addEventListener("click", function() {
    if (allowed()) userPaused = true;
    else { userPaused = false; motionOverride = motion.matches; }
    reconcile();
  });
  var motionChanged = function() { motionOverride = false; reconcile(); };
  if (motion.addEventListener) motion.addEventListener("change", motionChanged);
  else if (motion.addListener) motion.addListener(motionChanged);

  var hero = doc.getElementById("hero-video");
  var source = doc.getElementById("hero-src");
  var heroName = doc.getElementById("hero-name");
  var heroPack = doc.getElementById("hero-pack");
  var choices = [["julia", "Julia Fractal", "Classics"],
                 ["cyberspace", "Cyberspace", "Flight"],
                 ["skyline", "Skyline", "Arcade"]];
  var heroIndex = 0, loops = 0, previousTime = 0;
  if (hero && source) hero.addEventListener("timeupdate", function() {
    var record = records.get(hero);
    if (!shouldPlay(record) || hero.paused) return;
    if (previousTime > 0.4 && hero.currentTime < 0.2 && ++loops >= 2) {
      loops = 0;
      heroIndex = (heroIndex + 1) % choices.length;
      var choice = choices[heroIndex];
      record.epoch++;
      record.pending = false;
      record.blocked = false;
      source.src = "media/hero/" + choice[0] + ".mp4";
      hero.poster = "media/viz/" + choice[0] + ".jpg";
      if (heroName) heroName.textContent = choice[1];
      if (heroPack) heroPack.textContent = choice[2];
      hero.load();
      sync(record);
    }
    previousTime = hero.currentTime;
  });

  var copy = doc.getElementById("copy-launch-email");
  var address = doc.getElementById("launch-email-address");
  var copyStatus = doc.getElementById("launch-email-status");
  if (copy && address) {
    copy.hidden = false;
    copy.addEventListener("click", function() {
      var fallback = function() {
        address.focus();
        address.select();
        if (copyStatus) copyStatus.textContent = "Address selected. Copy it and send your request from any email service.";
      };
      if (!win.navigator.clipboard || !win.navigator.clipboard.writeText) { fallback(); return; }
      win.navigator.clipboard.writeText(address.value).then(function() {
        if (copyStatus) copyStatus.textContent = "Address copied. Send an email asking for the launch update.";
      }, fallback);
    });
  }
  reconcile();
}

if (typeof module !== "undefined" && module.exports) module.exports = { initializeSoundMuralPage: initializeSoundMuralPage };
if (typeof document !== "undefined" && typeof window !== "undefined") initializeSoundMuralPage(document, window);
