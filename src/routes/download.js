const express = require("express");
const router = express.Router();
const { CREATOR } = require("../config");
const { noCache, ax } = require("../utils/http");
const { cacheMedia } = require("../utils/cache");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📸 ALL DOWNLOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get("/api/dwnall", async (req, res) => {
  noCache(res);

  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        creator: CREATOR,
        message: "URL required"
      });
    }

    const api = `https://nayan-video-downloader.vercel.app/alldown?url=${encodeURIComponent(url)}`;

    const response = await ax.get(api, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const data = response.data;

    if (!data?.status || !data?.data) {
      return res.status(404).json({
        success: false,
        creator: CREATOR,
        message: "Media not found"
      });
    }

    const result = data.data;

    const ss = cacheMedia(req, result.low || null, ".mp4");
    const hd = cacheMedia(req, result.high || null, ".mp4");
    const thumbnail = cacheMedia(req, result.thumbnail || null, ".jpg");

    return res.json({
      success: true,
      creator: CREATOR,

      result: {
        title: result.title || "Unknown",
        thumbnail,

        ss,
        hd
      }
    });

  } catch (err) {

    if (err.code === "ECONNABORTED") {
      return res.status(408).json({
        success: false,
        creator: CREATOR,
        message: "Request timeout"
      });
    }

    return res.status(500).json({
      success: false,
      creator: CREATOR,
      error: err.message
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎥 YOUTUBE DOWNLOADER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get("/api/ytmp4", async (req, res) => {
  noCache(res);
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, creator: CREATOR, message: "YouTube URL is required" });

    const { data } = await ax.get(
      `https://bunny-allsocal-downv2.vercel.app/api/download?url=${encodeURIComponent(url)}`
    );

    const mp4_360  = data.videos.find(v => v.quality.includes("360p")  && v.extension === "mp4") || null;
    const mp4_720  = data.videos.find(v => v.quality.includes("720p")  && v.extension === "mp4") || null;
    const mp4_1080 = data.videos.find(v => v.quality.includes("1080p") && v.extension === "mp4") || null;
    const audio    = data.audios.find(a => a.quality.includes("131kb")) || null;

    const fmt = v => v ? { quality: v.quality, type: v.extension, url: v.url } : null;

    res.json({
      status: true,
      creator: CREATOR,
      metadata: {
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration
      },
      download: {
        video: {
          "360p": fmt(mp4_360),
          "720p": fmt(mp4_720),
          "1080p": fmt(mp4_1080)
        },
        audio: fmt(audio)
      }
    });
  } catch (err) {
    res.status(500).json({ status: false, creator: CREATOR, message: "Internal Server Error" });
  }
});

module.exports = router;
