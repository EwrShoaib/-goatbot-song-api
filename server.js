const express = require("express");
const { spawn } = require("child_process");

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
    return res.status(400).json({ error: "Song name is required" });
  }

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="song.mp3"'
  );

  const child = spawn("yt-dlp", [
    "--no-playlist",
    "--extract-audio",
    "--audio-format", "mp3",
    "--output", "-",
    `ytsearch1:${query}`
  ]);

  child.stdout.pipe(res);

  child.stderr.on("data", data => {
    console.error(data.toString());
  });

  child.on("error", err => {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "yt-dlp failed" });
    else res.destroy(err);
  });

  child.on("close", code => {
    if (code !== 0) {
      console.error("yt-dlp exit code:", code);
      if (!res.headersSent) res.status(500).end();
      else res.destroy();
    }
  });

  req.on("close", () => {
    if (!res.writableEnded) child.kill();
  });
});

app.listen(PORT, () => {
  console.log(`Song API listening on port ${PORT}`);
});
