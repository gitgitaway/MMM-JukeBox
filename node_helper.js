/* MMM-JukeBox node_helper
 * Scans local or USB directories for audio files, streams USB files, syncs USB to local,
 * and now persists volume settings server-side.
 */

const NodeHelper = require("node_helper");
const fs = require("fs");
const fsp = fs.promises; // Explanation: Use async fs operations for non-blocking IO
const path = require("path");

/* ---------------------------
 * Helpers: audio filters, titles
 * --------------------------- */

// Explanation: Build a predicate for allowed audio extensions (case-insensitive)
function makeIsAudioFile(extensions) {
  const allowed = new Set(
    (Array.isArray(extensions) ? extensions : [])
      .map((e) => (e.startsWith(".") ? e.toLowerCase() : "." + e.toLowerCase()))
  );
  if (allowed.size === 0) {
    [".mp3", ".wav", ".ogg", ".m4a"].forEach((e) => allowed.add(e));
  }
  return function isAudioFile(name) {
    const lower = name.toLowerCase();
    const dot = lower.lastIndexOf(".");
    if (dot === -1) return false;
    return allowed.has(lower.slice(dot));
  };
}

// Explanation: Convert filename to a nicer title (strip extension, numbers, underscores)
function toTitle(filename) {
  const base = filename.replace(/\.[^/.]+$/, "");
  const clean = base.replace(/[_]+/g, " ").trim();
  const match = clean.match(/^\s*\d+\s*[-_.]?\s*(.*)$/);
  return (match && match[1] ? match[1] : clean).trim();
}

/* ---------------------------
 * Simple JSON settings store (for persistent volume)
 * --------------------------- */

const SETTINGS_FILE = path.join(__dirname, "settings.json");

// Explanation: Safely read settings JSON (returns {} if missing/invalid)
function readSettings() {
  try {
    const s = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(s);
  } catch (_) {
    return {};
  }
}

// Explanation: Safely write settings JSON
function writeSettings(obj) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.error("[MMM-JukeBox helper] Failed to write settings:", e?.message || e);
  }
}

module.exports = NodeHelper.create({
  start() {
    this.logPrefix = "[MMM-JukeBox helper]";
    this.debugEnabled = false;
    this.debugFile = path.join(__dirname, ".logs", "debugLog.txt");
    try { fs.mkdirSync(path.join(__dirname, ".logs"), { recursive: true }); } catch (_) {}
  },

  /* ---------------------------
   * Express route: secure USB streaming
   * --------------------------- */
  getExpressApp() {
    const expressApp = this.expressApp;

    // Serve USB files via /MMM-JukeBox/usb?base=<encodedPath>&file=<encodedFilename>
    expressApp.get("/MMM-JukeBox/usb", (req, res) => {
      try {
        const base = req.query.base || "";
        const file = req.query.file || "";
        if (!base || !file) return res.status(400).send("Missing base or file");

        // Prevent path traversal
        const usbBase = path.resolve(base);
        const target = path.resolve(usbBase, file);
        if (!target.startsWith(usbBase)) return res.status(403).send("Forbidden");

        // Validate file existence
        if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
          return res.status(404).send("Not found");
        }

        const ext = path.extname(target).toLowerCase();
        const allowed = new Set([".mp3", ".wav", ".ogg", ".m4a"]);
        if (!allowed.has(ext)) {
          console.warn(this.logPrefix, "Blocked streaming for disallowed extension:", ext);
          return res.status(415).send("Unsupported Media Type");
        }

        const type =
          ext === ".wav" ? "audio/wav" :
          ext === ".ogg" ? "audio/ogg" :
          ext === ".m4a" ? "audio/mp4" :
          "audio/mpeg";
        res.setHeader("Content-Type", type);
        res.setHeader("Accept-Ranges", "bytes");

        const stat = fs.statSync(target);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          const match = range.match(/bytes=(\d*)-(\d*)/);
          const start = match && match[1] ? parseInt(match[1], 10) : 0;
          const end = match && match[2] ? parseInt(match[2], 10) : (fileSize - 1);
          if (isNaN(start) || isNaN(end) || start > end || end >= fileSize) {
            console.warn(this.logPrefix, "Invalid range header:", range);
            return res.status(416).set("Content-Range", `bytes */${fileSize}`).end();
          }
          res.status(206);
          res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
          res.setHeader("Content-Length", String(end - start + 1));
          fs.createReadStream(target, { start, end })
            .on("error", (e) => {
              console.error(this.logPrefix, "USB partial stream error:", e?.message || e);
              if (!res.headersSent) res.status(500);
              res.end();
            })
            .pipe(res);
        } else {
          res.setHeader("Content-Length", String(fileSize));
          fs.createReadStream(target)
            .on("error", (e) => {
              console.error(this.logPrefix, "USB full stream error:", e?.message || e);
              if (!res.headersSent) res.status(500);
              res.end();
            })
            .pipe(res);
        }
      } catch (e) {
        console.error(this.logPrefix, "USB route error:", e?.message || e);
        if (!res.headersSent) res.status(500).send("Error");
      }
    });

    return expressApp;
  },

  /* ---------------------------
   * Socket handlers
   * --------------------------- */
  socketNotificationReceived(notification, payload) {
    if (notification === "SCAN_SONGS") {
      const scanPath = payload?.path || null;
      const source = payload?.source || "file"; // "file", "USB", or "URL"
      const extensions = payload?.extensions || null;
      this.scanSongs(scanPath, source, extensions)
        .then((tracks) => this.sendSocketNotification("SONG_LIST", tracks))
        .catch((err) => {
          console.error(`${this.logPrefix} Scan error:`, err?.message || err);
          this.sendSocketNotification("SONG_LIST", []);
        });

    } else if (notification === "SYNC_USB_TO_LOCAL") {
      const usbBase = payload?.usbBase || "";
      const extensions = payload?.extensions || null;
      const dest = path.join(__dirname, "soundFiles");
      this.syncUsbToLocal(usbBase, dest, extensions)
        .then((result) => this.sendSocketNotification("SYNC_DONE", { ok: true, ...result }))
        .catch((err) => {
          console.error(`${this.logPrefix} Sync error:`, err?.message || err);
          this.sendSocketNotification("SYNC_DONE", { ok: false, error: err?.message || String(err) });
        });

    } else if (notification === "SAVE_VOLUME") {
      // Payload: { value: number in [0..1] }
      const value = Math.max(0, Math.min(1, Number(payload?.value ?? 0)));
      const s = readSettings();
      s.volume = value;
      writeSettings(s);

    } else if (notification === "GET_VOLUME") {
      const s = readSettings();
      const value = typeof s.volume === "number" ? s.volume : null;
      this.sendSocketNotification("VOLUME_VALUE", { value });

    } else if (notification === "PROBE_USB") {
      const p = payload?.path || "";
      try {
        const st = fs.statSync(p);
        if (!st.isDirectory()) throw new Error("Not a directory");
        this.sendSocketNotification("USB_PROBE_RESULT", { ok: true });
      } catch (e) {
        this.sendSocketNotification("USB_PROBE_RESULT", { ok: false, message: e?.message || String(e) });
      }
    } else if (notification === "SET_DEBUG") {
      // Payload: { enabled: boolean, lines?: string[] }
      this.debugEnabled = !!(payload && payload.enabled);
      if (this.debugEnabled) {
        try {
          fs.writeFileSync(this.debugFile, "", "utf-8");
          if (Array.isArray(payload?.lines) && payload.lines.length) {
            fs.appendFileSync(this.debugFile, payload.lines.join("\n") + "\n", "utf-8");
          }
        } catch (e) {
          console.error(this.logPrefix, "Failed to init debug file:", e?.message || e);
        }
      }
    } else if (notification === "DEBUG_LOG") {
      if (!this.debugEnabled) return;
      try {
        const line = typeof payload === "string" ? payload : JSON.stringify(payload);
        fs.appendFileSync(this.debugFile, line + "\n", "utf-8");
      } catch (e) {
        console.error(this.logPrefix, "Failed to append debug line:", e?.message || e);
      }
    }
  },

  /* ---------------------------
   * USB -> local sync (optional)
   * --------------------------- */
  async syncUsbToLocal(usbBase, destDir, extensions) {
    if (!usbBase) throw new Error("No USB base path provided");
    let srcStat;
    try {
      srcStat = await fsp.stat(usbBase);
    } catch {
      throw new Error("USB path not found");
    }
    if (!srcStat.isDirectory()) throw new Error("USB path is not a directory");

    try { await fsp.mkdir(destDir, { recursive: true }); } catch {}

    const isAudioFile = makeIsAudioFile(extensions);
    const entries = await fsp.readdir(usbBase, { withFileTypes: true });

    let copied = 0, skipped = 0;
    for (const ent of entries) {
      if (!ent.isFile() || !isAudioFile(ent.name)) continue;
      const src = path.join(usbBase, ent.name);
      const dst = path.join(destDir, ent.name);
      let needCopy = true;
      try {
        const [s, d] = await Promise.allSettled([fsp.stat(src), fsp.stat(dst)]);
        if (s.status === 'fulfilled' && d.status === 'fulfilled') {
          if (s.value.size === d.value.size && s.value.mtimeMs <= d.value.mtimeMs) needCopy = false;
        }
      } catch {}
      if (needCopy) {
        try { await fsp.copyFile(src, dst); copied++; } catch {}
      } else {
        skipped++;
      }
    }
    return { copied, skipped, dest: destDir };
  },

  /* ---------------------------
   * Scan songs (file/USB); URL mode returns empty (front-end supplies list)
   * --------------------------- */
  async scanSongs(scanPath, source, extensions) {
    if (!scanPath || source === "URL") return [];

    // Ensure directory exists
    let stat;
    try {
      stat = fs.statSync(scanPath);
    } catch (e) {
      return [];
    }
    if (!stat.isDirectory()) return [];

    const isAudioFile = makeIsAudioFile(extensions);

    // Read files in directory (non-recursive)
    const files = fs.readdirSync(scanPath, { withFileTypes: true })
      .filter((ent) => ent.isFile() && isAudioFile(ent.name))
      .map((ent) => ent.name);

    // Sort by natural numeric order if filenames start with numbers
    files.sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });

    // Build track list (front-end will prefix file paths accordingly)
    const tracks = files.map((fname) => ({
      file: fname,
      title: toTitle(fname),
      artist: "",
    }));

    return tracks;
  },
});
