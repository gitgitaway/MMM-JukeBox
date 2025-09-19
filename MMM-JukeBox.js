/* MMM-JukeBox MagicMirror Module
 * Version 1.1
 * Adds: Option of tradition buttons or control bar symbols, Volume control (UI optional), persistence (localStorage + backend), and application to all playback.
 * Author: gitgitaway with assistance from Zencoder AI */

Module.register("MMM-JukeBox", {
  defaults: {
    source: "file",               // "file", "USB", or "URL"
    usbPath: "D:/soundFiles",     // Change as needed for your USB mount point
    syncUsbToLocal: false,        // Sync files from USB to local storage (for persistent playback)
    tracks: [],                                            // Tracks are populated by node_helper scan; this initial shape is unused after scan
    allowedExtensions: [".mp3", ".wav", ".ogg", ".m4a"],   // Allowed extensions for scan (overridable from config.js)
   
    // UI options
    autostartRandomLoop: false,    // Controls whether the module will auto start random loop at startup
    showPauseButton: true,         // Show Pause/Resume button (legacy row)
    showStopButton: true,          // Show Stop button (legacy row)
    showControlBar: false,         // Default: show legacy Random/Pause/Stop row; set true to show ◀ ⏸ ▷ ✖ ▶ control bar
    marqueeNowPlaying: true, 
    continueOnHide: true,
    showVolumeControl: true,       // Toggle volume slider visibility      // Scroll long "Now Playing" text
    defaultVolume: 80,             // Default volume percent (0..100) used on first run
    volumeInputDebounceMs: 100,    // Debounce for volume slider oninput to reduce rapid updates
    updateDomThrottleMs: 100,      // Throttle interval for updateDom calls (ms)
    pageSize: 40,                  // Pagination - limits the number of buttons per page
    
    // Button Labels
    randomButtonText: "Random Play",
    stopButtonText: "Stop",
    volumeLabel: "Volume",        // Label displayed for the slider
    infoText: "Select a number or use Random Play.",
     
    // Grid button colour scheme options
		colorActive: "#018749",
		colorHover: "#FFD700",
		colorDefault: "#222",                    
  },

  start: function () {
    // State
    this.activeIdx = null;
    this.audio = null;                  // will be created once and reused
    this.randomMode = false;
    this.randomOrder = [];
    this.randomIdx = 0;
    this.stopped = false;
    this.tracksLoaded = false;
    this._autoStarted = false; // ensure we only autostart once
    this.config.tracks = []; // Will be filled after scan

    // Initialize throttled updateDom helper
    const throttleMs = Math.max(0, Number(this.config.updateDomThrottleMs || 0));
    this._throttledUpdateDom = this.debounce(() => { try { this.updateDom(); } catch (e) { console.error("[MMM-JukeBox] updateDom (throttled) error:", e?.message || e); } }, throttleMs);

    // Restore last UI state, best-effort
    const saved = this.loadPlaybackState();
    if (saved) {
      this.activeIdx = typeof saved.activeIdx === "number" ? saved.activeIdx : null;
      this.randomMode = !!saved.randomMode;
      this.stopped = !!saved.stopped;
    }

    // Initialize volume (0..1), prefer previously saved local value, otherwise config default
    this.volume =
      this.loadSavedVolume() ??
      Math.max(0, Math.min(1, (this.config.defaultVolume || 80) / 100));

    // Prepare debounced volume setter for oninput events
    const debounceMs = Math.max(0, Number(this.config.volumeInputDebounceMs || 0));
    this._debouncedSetVolume = this.debounce((v) => {
      try { this.setVolume(v, { persist: false }); } catch (e) { console.error("[MMM-JukeBox] debounced setVolume error:", e?.message || e); }
    }, debounceMs);

    // Configure backend debug logging
    if (this.config.debug === true) {
      this.sendSocketNotification("SET_DEBUG", { enabled: true, lines: ["[front] debug enabled"] });
    } else {
      this.sendSocketNotification("SET_DEBUG", { enabled: false });
    }

    // Ask backend if it has a stored volume; if so we will adopt it
    this.sendSocketNotification("GET_VOLUME");

    // If USB source, probe path once to warn early if inaccessible
    if (this.config.source === "USB" && this.config.usbPath) {
      this.sendSocketNotification("PROBE_USB", { path: this.config.usbPath });
    }

    // Kick off SONG_LIST delivery via node_helper
    this.scanTracks();
  },

  // Request scan with source and allowed extensions
  scanTracks: function () {
    let scanPath, sourceType;
    if (this.config.source === "USB") {
      scanPath = this.config.usbPath;
      sourceType = "USB";
    } else if (this.config.source === "file") {
      scanPath = this.file("soundFiles");
      sourceType = "file";
    } else {
      scanPath = null; // For URL, tracks should be set manually
      sourceType = "URL";
    }
    this.sendSocketNotification("SCAN_SONGS", {
      path: scanPath,
      source: sourceType,
      extensions: this.config.allowedExtensions
    });
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "SONG_LIST") {
      // payload: [{file, title, artist}]
      this.config.tracks = payload;
      this.tracksLoaded = true;
      this.updateDom();

      // If enabled, auto-start random loop exactly once after tracks load
      if (
        this.config.autostartRandomLoop === true &&
        !this._autoStarted &&
        Array.isArray(this.config.tracks) &&
        this.config.tracks.length > 0
      ) {
        this._autoStarted = true;
        this.startRandomPlay();
      }
    } else if (notification === "VOLUME_VALUE") {
      // payload: { value: number|null } from backend
      const v = payload && typeof payload.value === "number" ? payload.value : null;
      if (v !== null && !isNaN(v)) {
        // Clamp and apply; persist locally too so UI reflects it after reloads
        const clamped = Math.max(0, Math.min(1, Number(v)));
        this.volume = clamped;
        if (this.audio) this.audio.volume = clamped;
        this.saveVolume(clamped); // localStorage mirror
        this.updateDom();
      }
    } else if (notification === "USB_PROBE_RESULT") {
      // Explanation: Surface early warnings if USB path is inaccessible
      if (!payload?.ok) {
        console.warn("[MMM-JukeBox] USB path probe failed:", payload?.message || "Unknown error");
      }
    }
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "jukebox-wrapper";

    if (!this.tracksLoaded) {
      wrapper.innerHTML = "<div>Loading tracks...</div>";
      return wrapper;
    }

    if (this.tracksLoaded && (!this.config.tracks || this.config.tracks.length === 0)) {
      const noTracks = document.createElement("div");
      noTracks.className = "jukebox-info";
      noTracks.innerText = "No tracks found. Check your source path or extensions.";
      wrapper.appendChild(noTracks);
      return wrapper;
    }

    // Info
    const info = document.createElement("div");
    info.className = "jukebox-info";
    info.innerText = this.config.infoText;
    wrapper.appendChild(info);

    // Pagination state
    const pageSize = Math.max(1, parseInt(this.config.pageSize || 30, 10));
    const total = this.config.tracks.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(this.currentPage || 1, totalPages);
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);

    // Save for navigation helpers
    this._pageSizeCached = pageSize;
    this._totalPagesCached = totalPages;
    this._currentPageCached = currentPage;

    // Track grid
    const grid = document.createElement("div");
    grid.className = "jukebox-grid";
    for (let i = start; i < end; i++) {
      const track = this.config.tracks[i];
      const btn = document.createElement("button");
      btn.className = "jukebox-btn";
      btn.innerText = `${i + 1}`;
      // Lazy tooltip generation on first hover/focus
      const setTip = () => {
        if (btn.hasAttribute("data-tipset")) return;
        const tipParts = [];
        tipParts.push(track.title || `Track ${i + 1}`);
        if (track.artist) tipParts.push(`by ${track.artist}`);
        if (track.duration) tipParts.push(`(${track.duration})`);
        btn.title = tipParts.join(" ");
        btn.setAttribute("data-tipset", "1");
      };
      btn.onmouseenter = setTip;
      btn.onfocus = setTip;
      if (this.activeIdx === i) btn.classList.add("active");
      btn.onclick = () => this.playTrack(i);
      grid.appendChild(btn);
    }
    wrapper.appendChild(grid);

    // Pagination controls
    if (totalPages > 1) {
      const pager = document.createElement("div");
      pager.className = "jukebox-pager";

      const prev = document.createElement("button");
      prev.className = "jukebox-pager-btn";
      prev.innerText = "Prev";
      prev.disabled = currentPage <= 1;
      prev.onclick = () => { this.currentPage = Math.max(1, currentPage - 1); this.updateDom(); };

      const next = document.createElement("button");
      next.className = "jukebox-pager-btn";
      next.innerText = "Next";
      next.disabled = currentPage >= totalPages;
      next.onclick = () => { this.currentPage = Math.min(totalPages, currentPage + 1); this.updateDom(); };

      const pageInfo = document.createElement("span");
      pageInfo.className = "jukebox-page-info";
      pageInfo.innerText = `Page ${currentPage}/${totalPages}`;

      pager.appendChild(prev);
      pager.appendChild(pageInfo);
      pager.appendChild(next);
      wrapper.appendChild(pager);
    }

    // Controls: either a 5-button symbol control bar or a legacy Random/Pause/Stop row
    if (this.config.showControlBar === true) {
      // Control bar with symbols: ◀ (Prev), ⏸ (Pause/Resume), ▷ (Play), ✖ (Stop), ▶ (Next)
      const barWrap = document.createElement("div");
      barWrap.style.display = "flex";
      barWrap.style.alignItems = "center";
      barWrap.style.justifyContent = "center";
      barWrap.style.gap = "8px";

      // When control bar is shown, we show a Shuffle (🔀) icon; no need to render legacy Random button here

      const bar = document.createElement("div");
      bar.className = "jukebox-icon-bar"; // reuse existing bar styling

      // Helper to create a symbol button with accessibility and handler
      const makeSymBtn = (symbol, label, handler, activeClassGetter) => {
        const b = document.createElement("button");
        b.className = "jukebox-icon-btn";
        b.setAttribute("aria-label", label);
        b.title = label; // native tooltip for mouse users
        b.textContent = symbol;
        b.onclick = handler;
        // Apply active class if provided
        const cls = activeClassGetter && activeClassGetter();
        if (cls) b.classList.add(cls);
        return b;
      };

      // Initial inactive state when autostartRandomLoop is false and nothing has been clicked yet
      const noInteraction = !this._userInteracted && this.config.autostartRandomLoop === false;
      const isPaused = noInteraction ? false : !!(this.audio && this.audio.paused);
      const isPlaying = noInteraction ? false : !!(this.audio && !this.audio.paused);
      const isStopped = noInteraction ? false : !!(!this.audio || this.stopped || this.activeIdx === null);

      // Order: Shuffle, Previous, Pause, Play, Stop, Next
      bar.appendChild(makeSymBtn("🔀", "Shuffle (Random Play)", () => { this._userInteracted = true; this.startRandomPlay(); }, () => (this.randomMode ? "active-play" : "")));
      bar.appendChild(makeSymBtn("◀", "Previous", () => { this._userInteracted = true; this.playPrev(); }, null));
      bar.appendChild(makeSymBtn("⏸", "Pause/Resume", () => { this._userInteracted = true; this.togglePause(); }, () => (isPaused ? "active-pause" : "")));
      bar.appendChild(makeSymBtn("▷", "Play", () => { this._userInteracted = true; this.playButtonAction(); }, () => (isPlaying ? "active-play" : "")));
      bar.appendChild(makeSymBtn("✖", "Stop", () => { this._userInteracted = true; this.stopAudio(); }, () => (isStopped ? "active-stop" : "")));
      bar.appendChild(makeSymBtn("▶", "Next", () => { this._userInteracted = true; this.playNext(); }, null));

      barWrap.appendChild(bar);
      wrapper.appendChild(barWrap);
    } else {
      // Legacy row: Random, Pause/Resume, Stop — all on the same row
      const legacy = document.createElement("div");
      legacy.className = "jukebox-legacy-controls";

      // Random
      const randomBtn = document.createElement("button");
      randomBtn.className = "jukebox-random-btn";
      randomBtn.innerText = this.config.randomButtonText;
      if (this.randomMode) randomBtn.classList.add("active");
      randomBtn.title = this.config.randomButtonText;
      randomBtn.setAttribute("aria-label", this.config.randomButtonText);
      randomBtn.onclick = () => { this._userInteracted = true; this.startRandomPlay(); };
      legacy.appendChild(randomBtn);

      // Pause/Resume
      const isPausedLegacy = !!(this.audio && this.audio.paused);
      const pauseBtn = document.createElement("button");
      pauseBtn.className = "jukebox-pause-btn";
      pauseBtn.innerText = isPausedLegacy ? "Resume" : "Pause";
      pauseBtn.title = isPausedLegacy ? "Resume" : "Pause";
      pauseBtn.setAttribute("aria-label", isPausedLegacy ? "Resume" : "Pause");
      pauseBtn.onclick = () => { this._userInteracted = true; this.togglePause(); };
      legacy.appendChild(pauseBtn);

      // Stop
      const stopBtn = document.createElement("button");
      stopBtn.className = "jukebox-stop-btn";
      stopBtn.innerText = this.config.stopButtonText;
      stopBtn.title = this.config.stopButtonText;
      stopBtn.setAttribute("aria-label", this.config.stopButtonText);
      stopBtn.onclick = () => { this._userInteracted = true; this.stopAudio(); };
      legacy.appendChild(stopBtn);

      wrapper.appendChild(legacy);
    }

    // Volume control (optional)
    if (this.config.showVolumeControl) {
      const volWrap = document.createElement("div");
      volWrap.className = "jukebox-volume";

      const volLabel = document.createElement("span");
      volLabel.className = "jukebox-volume-label";
      const percent = Math.round((this.volume || 0) * 100);
      volLabel.innerText = `${this.config.volumeLabel}: ${percent}%`;

      const volInput = document.createElement("input");
      volInput.type = "range";
      volInput.min = "0";
      volInput.max = "100";
      volInput.step = "1";
      volInput.value = String(percent);
      volInput.className = "jukebox-volume-range";

      // Live preview during drag (debounced to reduce rapid updates)
      volInput.oninput = (e) => {
        const p = Math.max(0, Math.min(100, parseInt(e.target.value || "0", 10)));
        const vol = p / 100;
        volLabel.innerText = `${this.config.volumeLabel}: ${p}%`;
        if (typeof this._debouncedSetVolume === "function") {
          this._debouncedSetVolume(vol);
        } else {
          this.setVolume(vol, { persist: false });
        }
      };
      // Persist volume when user releases/changes
      volInput.onchange = (e) => {
        const p = Math.max(0, Math.min(100, parseInt(e.target.value || "0", 10)));
        const vol = p / 100;
        this.setVolume(vol, { persist: true }); // save locally + backend
      };

      volWrap.appendChild(volLabel);
      volWrap.appendChild(volInput);
      wrapper.appendChild(volWrap);
    }

    // Now playing
    const nowPlaying = document.createElement("div");
    nowPlaying.className = "jukebox-nowplaying";
    const nowText = document.createElement("span");
    nowText.className = "jukebox-nowplaying-text";
    if (this.activeIdx !== null) {
      const track = this.config.tracks[this.activeIdx];
      let info = `Now Playing: ${track.title || "Unknown Title"}`;
      if (track.artist) info += ` by ${track.artist}`;
      if (track.duration) info += ` (${track.duration})`;
      nowText.textContent = info;
      if (this.config.marqueeNowPlaying && info.length > 30) {
        nowText.classList.add("marquee");
      }
    } else if (this.randomMode) {
      nowText.textContent = "Random Play: Waiting...";
    } else {
      nowText.textContent = "";
    }
    nowPlaying.appendChild(nowText);
    wrapper.appendChild(nowPlaying);

    return wrapper;
  },

  // Build a safe audio URL for different sources
  buildAudioSrc: function(track) {
    if (this.config.debug) this.sendSocketNotification("DEBUG_LOG", `[front] buildAudioSrc for ${track?.title || track?.file || 'unknown'}`);
    if (this.config.source === "URL" && track.url) return track.url;
    if (this.config.source === "USB") {
      // Stream via backend to avoid file:/// restrictions in browser
      const base = encodeURIComponent(this.config.usbPath);
      const fname = encodeURIComponent(track.file);
      return `/MMM-JukeBox/usb?base=${base}&file=${fname}`;
    }
    // default local file in module
    return this.file("soundFiles/" + track.file);
  },

  // Play a specific track (reuses a single Audio element)
  playTrack: function (idx) {
    try {
      // Stop any current playback without discarding the audio element
      if (this.audio) {
        try { this.audio.pause(); } catch (_) {}
        try { this.audio.currentTime = 0; } catch (_) {}
      }
      const track = this.config.tracks[idx];
      if (!track || (!track.file && !track.url)) {
        console.warn("[MMM-JukeBox] playTrack: invalid track at index", idx, track);
        return;
      }
      this.activeIdx = idx;
      this.randomMode = false;
      this.stopped = false;

      const audioSrc = this.buildAudioSrc(track);
      if (!audioSrc || typeof audioSrc !== "string") {
        console.error("[MMM-JukeBox] playTrack: invalid audio source for track", track);
        this.activeIdx = null;
        this._throttledUpdateDom();
        return;
      }

      // Create once and reuse the same Audio element
      if (!this.audio) {
        this.audio = new Audio();
      }
      this.audio.src = audioSrc;
      this.audio.volume = this.volume;

      // Ensure active page shows this track number
      this.ensurePageForIndex(idx);

      this.audio.onloadedmetadata = () => {
        track.duration = this.formatDuration(this.audio.duration);
        this.savePlaybackState();
        this._throttledUpdateDom();
      };
      this.audio.onended = () => {
        this.activeIdx = null;
        this.savePlaybackState();
        this._throttledUpdateDom();
      };
      this.audio.onerror = (ev) => {
        console.error("[MMM-JukeBox] Audio error on playTrack:", { src: audioSrc, ev });
        this.activeIdx = null;
        this.savePlaybackState();
        this._throttledUpdateDom();
      };

      const playPromise = this.audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          console.error("[MMM-JukeBox] audio.play() rejected:", err?.message || err, { src: audioSrc });
          this.activeIdx = null;
          this.savePlaybackState();
          this._throttledUpdateDom();
        });
      }
      this.savePlaybackState();
      this._throttledUpdateDom();
    } catch (e) {
      console.error("[MMM-JukeBox] playTrack exception:", e?.message || e);
      this.activeIdx = null;
      this.savePlaybackState();
      this._throttledUpdateDom();
    }
  },

  // Start continuous random play
  startRandomPlay: function () {
    try {
      this.stopAudio();
      this.randomOrder = this.shuffleArray(
        Array.from({ length: this.config.tracks.length }, (_, i) => i)
          .filter(i => this.config.tracks[i].file || this.config.tracks[i].url)
      );
      this.randomIdx = 0;
      this.randomMode = true;
      this.stopped = false;
      if (this.randomOrder.length === 0) {
        console.warn("[MMM-JukeBox] Random play requested but no playable tracks were found.");
        this.randomMode = false;
        return;
      }
      this.playNextRandom();
    } catch (e) {
      console.error("[MMM-JukeBox] startRandomPlay failed:", e?.message || e, e);
      this.randomMode = false;
    }
  },

  // Play next track in random order (reuses a single Audio element)
  playNextRandom: function () {
    try {
      if (!this.randomMode || this.stopped) return;
      if (this.randomOrder.length === 0) {
        console.warn("[MMM-JukeBox] playNextRandom: empty random order.");
        return;
      }
      const idx = this.randomOrder[this.randomIdx];
      this.activeIdx = idx;
      const track = this.config.tracks[idx];

      const audioSrc = this.buildAudioSrc(track);
      if (!audioSrc) {
        console.error("[MMM-JukeBox] playNextRandom: Invalid src for track", track);
        this.randomIdx = (this.randomIdx + 1) % this.randomOrder.length;
        return this.playNextRandom();
      }

      // Create once and reuse the same Audio element
      if (!this.audio) this.audio = new Audio();
      else { try { this.audio.pause(); } catch (_) {} }
      this.audio.src = audioSrc;
      this.audio.volume = this.volume; // Apply current volume

      // Ensure active page shows this track number
      this.ensurePageForIndex(idx);

      this.audio.onloadedmetadata = () => {
        track.duration = this.formatDuration(this.audio.duration);
        this.savePlaybackState();
        this._throttledUpdateDom();
      };
      this.audio.onended = () => {
        this.randomIdx = (this.randomIdx + 1) % this.randomOrder.length;
        this.savePlaybackState();
        this.playNextRandom();
      };
      this.audio.onerror = (ev) => {
        console.error("[MMM-JukeBox] Audio error in random mode:", { src: audioSrc, ev });
        this.randomIdx = (this.randomIdx + 1) % this.randomOrder.length;
        this.savePlaybackState();
        this.playNextRandom();
      };

      const playPromise = this.audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          console.error("[MMM-JukeBox] audio.play() rejected (random):", err?.message || err, { src: audioSrc });
          this.randomIdx = (this.randomIdx + 1) % this.randomOrder.length;
          this.playNextRandom();
        });
      }
      this._throttledUpdateDom();
    } catch (e) {
      console.error("[MMM-JukeBox] playNextRandom exception:", e?.message || e);
      this.randomIdx = (this.randomIdx + 1) % (this.randomOrder.length || 1);
      if (this.randomMode && !this.stopped) this.playNextRandom();
    }
  },

  // Stop any playing audio (do not discard the audio element to enable reuse)
  stopAudio: function () {
    if (this.audio) {
      try { this.audio.pause(); } catch (_) {}
      try { this.audio.currentTime = 0; } catch (_) {}
    }
    // Remember last active index so Resume can re-highlight the track
    if (typeof this.activeIdx === "number") this._lastActiveIdx = this.activeIdx;
    this.activeIdx = null;
    this.randomMode = false;
    this.stopped = true;
    this.savePlaybackState();
    this._throttledUpdateDom();
  },

  // Pause/Resume toggle without resetting playback position
  togglePause: function () {
    try {
      if (!this.audio) return;
      if (this.audio.paused) {
        const p = this.audio.play();
        if (p && typeof p.catch === 'function') p.catch(()=>{});
        this.stopped = false;
      } else {
        this.audio.pause();
      }
      this.savePlaybackState();
      this._throttledUpdateDom();
    } catch (e) {
      console.error("[MMM-JukeBox] togglePause error:", e?.message || e);
    }
  },

  // Play button action: resume if paused, otherwise start current/first playable
  playButtonAction: function () {
    try {
      if (this.audio && this.audio.paused) {
        const p = this.audio.play();
        if (p && typeof p.catch === 'function') p.catch(()=>{});
        this.stopped = false;
        // If stop was used previously, restore highlight of the last active index
        if (this._lastActiveIdx != null && typeof this._lastActiveIdx === 'number') {
          this.activeIdx = this._lastActiveIdx;
        }
        this.savePlaybackState();
        this._throttledUpdateDom();
        return;
      }
      // If something active, replay it; else if we have a previous active, resume it; else play first playable
      if (this.activeIdx !== null) return this.playTrack(this.activeIdx);
      if (this._lastActiveIdx != null && typeof this._lastActiveIdx === 'number') return this.playTrack(this._lastActiveIdx);
      const idx = (this.config.tracks || []).findIndex(t => t && (t.file || t.url));
      if (idx >= 0) this.playTrack(idx);
    } catch (e) {
      console.error("[MMM-JukeBox] playButtonAction error:", e?.message || e);
    }
  },

  // Play next track in sequence (not random order)
  playNext: function () {
    try {
      const total = (this.config.tracks || []).length;
      if (!total) return;
      const curr = this.activeIdx ?? -1;
      let next = (curr + 1) % total;
      // seek next playable
      for (let step = 0; step < total; step++) {
        const t = this.config.tracks[next];
        if (t && (t.file || t.url)) break;
        next = (next + 1) % total;
      }
      this.playTrack(next);
    } catch (e) {
      console.error("[MMM-JukeBox] playNext error:", e?.message || e);
    }
  },

  // Play previous track in sequence
  playPrev: function () {
    try {
      const total = (this.config.tracks || []).length;
      if (!total) return;
      const curr = this.activeIdx ?? 0;
      let prev = (curr - 1 + total) % total;
      // seek previous playable
      for (let step = 0; step < total; step++) {
        const t = this.config.tracks[prev];
        if (t && (t.file || t.url)) break;
        prev = (prev - 1 + total) % total;
      }
      this.playTrack(prev);
    } catch (e) {
      console.error("[MMM-JukeBox] playPrev error:", e?.message || e);
    }
  },

  // Format seconds to m:ss
  formatDuration: function (seconds) {
    if (!seconds || isNaN(seconds)) return "";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  },

  // Utility: debounce function calls
  debounce: function (fn, wait) {
    // Explanation: Returns a debounced wrapper that delays invocations by `wait` ms.
    let t = null;
    return function (...args) {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  // Utility: Fisher–Yates shuffle for unbiased random order
  shuffleArray: function (arr) {
    // Explanation: In-place shuffle to avoid bias of Array.sort(() => Math.random() - 0.5)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // Set current volume (0..1); optionally persist locally and on backend
  setVolume: function (vol01, opts = { persist: true }) {
    const v = Math.max(0, Math.min(1, Number(vol01) || 0)); // clamp
    this.volume = v;
    if (this.audio) this.audio.volume = v;
    if (opts.persist) this.saveVolume(v);
  },

  // Persist volume to localStorage and backend
  saveVolume: function (vol01) {
    try {
      localStorage.setItem("MMM-JukeBox.volume", String(vol01));
    } catch (_) {}
    // also persist on backend so it survives browser cache clears
    this.sendSocketNotification("SAVE_VOLUME", { value: vol01 });
  },

  // Load saved volume (0..1) from localStorage, if available
  loadSavedVolume: function () {
    try {
      const raw = localStorage.getItem("MMM-JukeBox.volume");
      if (raw == null) return null;
      const v = Number(raw);
      return isNaN(v) ? null : Math.max(0, Math.min(1, v));
    } catch (_) {
      return null;
    }
  },

  // Persist simple playback state for UI restoration across reloads
  savePlaybackState: function () {
    try {
      const state = {
        activeIdx: this.activeIdx,
        paused: !!(this.audio && this.audio.paused),
        stopped: !!this.stopped,
        randomMode: !!this.randomMode
      };
      localStorage.setItem("MMM-JukeBox.state", JSON.stringify(state));
    } catch (_) {}
  },
  loadPlaybackState: function () {
    try {
      const raw = localStorage.getItem("MMM-JukeBox.state");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  },

  notificationReceived: function (notif, payload, sender) {
    if (notif === "HIDE" && this.config.continueOnHide && this.audio && !this.audio.paused) {
      // Do nothing, let audio continue
    } else if (notif === "HIDE" || notif === "SUSPEND" || notif === "STOP") {
      this.stopAudio();
    }
  },

  // Keyboard shortcuts for quick control
  getScripts: function () {
    // No external scripts required, but we could return [] explicitly
    return [];
  },
  getHeader: function () {
    // Attach key listener once the module is loaded into DOM
    if (!this._keysAttached) {
      this._keysAttached = true;
      window.addEventListener("keydown", (e) => {
        try {
          // Avoid interfering with inputs
          const tag = (e.target && e.target.tagName) || "";
          if (tag === "INPUT" || tag === "TEXTAREA") return;
          // Controls: ArrowLeft=Prev, ArrowRight=Next, Space=Play/Pause toggle, KeyS=Stop, KeyR=Random
          if (e.code === "ArrowLeft") { this.playPrev(); e.preventDefault(); }
          else if (e.code === "ArrowRight") { this.playNext(); e.preventDefault(); }
          else if (e.code === "Space") { this.audio && !this.audio.paused ? this.togglePause() : this.playButtonAction(); e.preventDefault(); }
          else if (e.code === "KeyS") { this.stopAudio(); e.preventDefault(); }
          else if (e.code === "KeyR") { this.startRandomPlay(); e.preventDefault(); }
        } catch (_) {}
      }, { passive: false });
    }
    return this.data.header;
  },

  getStyles: function () {
    return [this.file("MMM-JukeBox.css")];
  },

  // Ensure the current page shows the provided 0-based track index
  ensurePageForIndex: function (idx) {
    try {
      const pageSize = this._pageSizeCached || Math.max(1, parseInt(this.config.pageSize || 30, 10));
      const total = (this.config.tracks || []).length;
      if (!total || idx == null || idx < 0 || idx >= total) return;
      const targetPage = Math.floor(idx / pageSize) + 1; // 1-based pages
      if (this.currentPage !== targetPage) {
        this.currentPage = targetPage;
        this.updateDom();
      }
    } catch (e) {
      console.error("[MMM-JukeBox] ensurePageForIndex error:", e?.message || e);
    }
  }
});
