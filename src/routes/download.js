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
// 🐇 TERABOX V2 — STREAM / DOWNLOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get("/teraboxv2", async (req, res) => {
  noCache(res);

  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: "error",
        creator: CREATOR,
        message: "URL required"
      });
    }

    const api = `https://nayan-video-downloader.vercel.app/teraboxv2?url=${encodeURIComponent(url)}`;

    const response = await ax.get(api, {
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const data = response.data;

    if (!data?.status || data.status !== "success" || !Array.isArray(data.videos) || !data.videos.length) {
      return res.status(404).json({
        status: "error",
        creator: CREATOR,
        message: "No videos found in this link"
      });
    }

    const videos = data.videos.map((v) => {
      // Re-cache every quality inside fast_stream_url under our own domain
      const fastStream = {};
      if (v.fast_stream_url) {
        for (const [quality, link] of Object.entries(v.fast_stream_url)) {
          fastStream[quality] = cacheMedia(req, link || null, ".m3u8");
        }
      }

      const cachedDownload = cacheMedia(req, v.normal_dlink || null, ".mp4");

      return {
        fs_id: v.fs_id,
        name: v.name,
        file_path: v.file_path,
        size: v.size,
        size_formatted: v.size_formatted,
        type: v.type,
        is_dir: v.is_dir,
        duration: v.duration || null,
        quality: v.quality || null,
        normal_dlink: cachedDownload,
        download_link: cachedDownload,
        stream_url: cacheMedia(req, v.stream_url || null, ".m3u8"),
        fast_stream_url: fastStream,
        subtitle_url: cacheMedia(req, v.subtitle_url || null, ".vtt"),
        thumbnail: cacheMedia(req, v.thumbnail || null, ".webp"),
        folder: v.folder || "root"
      };
    });

    return res.json({
      status: "success",
      creator: CREATOR,
      total_files: data.total_files ?? videos.length,
      total_folders: data.total_folders ?? 0,
      videos
    });

  } catch (err) {
    if (err.code === "ECONNABORTED") {
      return res.status(408).json({
        status: "error",
        creator: CREATOR,
        message: "Request timeout"
      });
    }

    return res.status(500).json({
      status: "error",
      creator: CREATOR,
      message: "Internal Server Error",
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
