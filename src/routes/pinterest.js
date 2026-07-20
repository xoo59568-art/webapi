const express = require("express");
const router = express.Router();
const { CREATOR } = require("../config");
const { noCache, ax } = require("../utils/http");
const { cacheMedia } = require("../utils/cache");

router.get("/search/pinterest", async (req, res) => {
  noCache(res);
  try {
    const { q, type, limit } = req.query;
    if (!q) return res.status(400).json({ status: false, creator: CREATOR, message: "Query is required" });

    const { data } = await ax.get(
      `https://jerrycoder.oggyapi.workers.dev/search/pin?q=${encodeURIComponent(q)}&type=${type || "both"}&limit=${limit || 10}`
    );

    res.json({
      status: true,
      creator: CREATOR,
      query: q,
      type: data.type,
      total: data.total,
      result: data.result
    });
  } catch (err) {
    res.status(500).json({ status: false, creator: CREATOR });
  }
});

router.get("/api/pinterest", async (req, res) => {
  noCache(res);
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, creator: CREATOR, message: "Pinterest URL is required" });

    const { data } = await ax.get(
      `https://jerrycoder.oggyapi.workers.dev/down/pinterest?url=${encodeURIComponent(url)}`
    );

    const proxy = cacheMedia(req, data.url, ".mp4", 10 * 60 * 1000, "redirect");
    const thumbnail = cacheMedia(req, data.thumbnail, ".jpg");

    res.json({
      status: true,
      creator: CREATOR,
      title: data.title,
      author: data.author,
      thumbnail,
      url: proxy
    });
  } catch (err) {
    res.status(500).json({ status: false, creator: CREATOR, message: "Internal Server Error" });
  }
});

router.get("/api/pint", async (req, res) => {
  noCache(res);
  try {
    const { url } = req.query;
    if (!url) return res.json({ status: false, creator: CREATOR });

    const { data } = await ax.get(
      `https://apis.davidcyril.name.ng/download/pinterest?url=${encodeURIComponent(url)}`
    );

    if (!data.success) return res.json({ status: false, creator: CREATOR, error: "Failed to fetch Pinterest media" });

    const medias = data.data.medias || [];
    const video = medias.find(v => v.extension === "mp4") || medias[0];

    const ext = video.extension ? `.${video.extension}` : ".mp4";
    const proxy = cacheMedia(req, video.url, ext, 10 * 60 * 1000, "redirect");
    const thumbnail = cacheMedia(req, data.data.thumbnail, ".jpg");

    res.json({
      status: true,
      creator: CREATOR,
      title: data.data.title,
      thumbnail,
      quality: video.quality,
      ext: video.extension,
      size: video.formattedSize,
      url: proxy
    });
  } catch (e) {
    res.json({ status: false, creator: CREATOR, error: e.message });
  }
});

module.exports = router;
