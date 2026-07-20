const express = require("express");
const router = express.Router();
const { CREATOR } = require("../config");
const { noCache, ax } = require("../utils/http");
const { cacheMedia } = require("../utils/cache");

router.get("/search/spotify", async (req, res) => {
  noCache(res);
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ status: false, creator: CREATOR, message: "Query is required" });

    const { data } = await ax.get(
      `https://jerrycoder.oggyapi.workers.dev/search/spotify?q=${encodeURIComponent(q)}&limit=${limit || 15}`
    );

    res.json({
      status: true,
      creator: CREATOR,
      query: q,
      total: data.tracks?.length || 0,
      result: data.tracks || []
    });
  } catch (err) {
    res.status(500).json({ status: false, creator: CREATOR, message: "Internal Server Error" });
  }
});

router.get("/api/spotify", async (req, res) => {
  noCache(res);
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, creator: CREATOR, message: "Spotify URL is required" });

    const { data } = await ax.get(
      `https://jerrycoder.oggyapi.workers.dev/down/spotify?url=${encodeURIComponent(url)}`
    );

    const proxy = cacheMedia(req, data.download_link, ".mp3", 10 * 60 * 1000, "redirect");

    res.json({
      status: true,
      creator: CREATOR,
      title: data.title,
      artist: data.artist,
      duration: data.duration,
      thumbnail: data.thumbnail,
      url: proxy
    });
  } catch (err) {
    res.status(500).json({ status: false, creator: CREATOR, message: "Internal Server Error" });
  }
});

module.exports = router;
