const express = require("express");
const router = express.Router();
const multer = require("multer");
const { CREATOR } = require("../config");
const { noCache } = require("../utils/http");
const { cacheBufferMedia } = require("../utils/cache");
const { generateGhibliBuffer } = require("../utils/ghibliGenerator");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 GHIBLI PHOTO MAKER
// GET  /api/maker/ghibli?url=<image_url>
// POST /api/maker/ghibli   (form-data: image=@photo.jpg)
//
// Same pattern as /api/removebg: the AI backend's own result URL is
// never exposed to the client — we download the finished image once
// and cache it as bytes under our own domain via cacheBufferMedia,
// so /media/:file streams it directly from memory.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get("/api/maker/ghibli", async (req, res) => {
  noCache(res);
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({
      status: false, creator: CREATOR, message: "Image URL required"
    });

    const { buffer, contentType } = await generateGhibliBuffer(url);
    const proxy = cacheBufferMedia(req, buffer, contentType, ".jpg");

    res.json({
      status: "success",
      creator: CREATOR,
      result: { url: proxy }
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      creator: CREATOR,
      message: err.message || "Failed to generate Ghibli image"
    });
  }
});

router.post("/api/maker/ghibli", upload.single("image"), async (req, res) => {
  noCache(res);
  try {
    if (!req.file) return res.status(400).json({
      status: false, creator: CREATOR, message: "Image file required"
    });

    const { buffer, contentType } = await generateGhibliBuffer(req.file.buffer);
    const proxy = cacheBufferMedia(req, buffer, contentType, ".jpg");

    res.json({
      status: "success",
      creator: CREATOR,
      result: { url: proxy }
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      creator: CREATOR,
      message: err.message || "Failed to generate Ghibli image"
    });
  } finally {
    if (req.file) req.file.buffer = null;
  }
});

module.exports = router;
