
const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

app.get("/health", (req, res) => {
  res.json({ success: true, message: "Song API is running" });
});

app.get("/api/song", (req, res) => {
  if (!API_KEY || req.headers["x-api-key"] !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const query = String(req.query.q || "").trim();

  if (!query) {
    return res.status(400).json({
      error: "Song name is required"
    });
  }

  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "song-")
  );
  const output = path.join(dir, "song.%(ext)s");
  let finished = false;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    fs.rm(dir, { recursive: true, force: true }, () => {});
  };

  const child = spawn("yt-dlp", [
    "--no-playlist",
    "--extract-audio",
    "--audio-format", "mp3",
    "--output", output,
    `ytsearch1:${query}`
  ]);

  let errorText = "";

  child.stderr.on("data", data => {
    errorText += data.toString();
    console.error(data.toString());
  });

  child.on("error", err => {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Could not start yt-dlp" });
    }
    cleanup();
  });

  child.on("close", code => {
    if (res.destroyed) {
      cleanup();
      return;
    }

    if (code !== 0) {
      console.error("yt-dlp exit code:", code, errorText);
      if (!res.headersSent) {
        res.status(500).json({ error: "Song download failed" });
      } else {
        res.end();
      }
      cleanup();
      return;
    }

    const file = path.join(dir, "song.mp3");

    if (!fs.existsSync(file)) {
      res.status(500).json({ error: "MP3 file was not created" });
      cleanup();
      return;
    }

    res.download(file, "song.mp3", err => {
      if (err && !res.destroyed) {
        console.error(err);
      }
      cleanup();
    });
  });

  res.on("close", () => {
    if (!res.writableEnded) {
      child.kill();
      cleanup();
    }
  });
});

app.listen(PORT, () => {
  console.log(`Song API listening on port ${PORT}`);
});
