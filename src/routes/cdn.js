const express = require("express");
const router = express.Router();
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const { CREATOR } = require("../config");
const { noCache, ax, safeDestroy } = require("../utils/http");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ☁️ CDN UPLOAD (file)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.post("/cdn/upload", upload.single("file"), async (req, res) => {
  noCache(res);
  try {
    if (!req.file) return res.json({ status: false, creator: CREATOR, message: "No file uploaded" });

    const form = new FormData();
    form.append("file", req.file.buffer, req.file.originalname);

    const response = await ax.post("https://cdnfile.pages.dev/upload", form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity
    });

    const filename = response.data.url.split("/").pop();
    const base = `${req.protocol}://${req.get("host")}`;

    res.json({
      status: true,
      creator: CREATOR,
      filename,
      url: `${base}/file/${filename}`,
      cdn: `${base}/file/${filename}`
    });
  } catch (e) {
    res.json({ status: false, creator: CREATOR, error: e.message });
  } finally {
    // free buffer from memory immediately
    if (req.file) req.file.buffer = null;
  }
});

router.post("/upload", upload.single("file"), async (req, res) => {
  noCache(res);
  try {
    if (!req.file) return res.status(400).json({ success: false, code: 400, creator: CREATOR, message: "No file uploaded" });

    const form = new FormData();
    form.append("file", req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });

    const response = await ax.post("https://ar-hosting.pages.dev/upload", form, {
      headers: { ...form.getHeaders() },
      timeout: 120000,
      maxBodyLength: Infinity
    });

    const filename = response.data.url.split("/").pop();
    const base = `${req.protocol}://${req.get("host")}`;

    res.json({
      success: true,
      code: 200,
      creator: "RabbitX CDN",
      result: {
        name: filename,
        size: response.data.size,
        type: response.data.media_type,
        uploaded: response.data.uploaded_on,
        url: `${base}/cdn/${filename}`,
        cdn: `${base}/cdn/${filename}`
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, code: 500, creator: CREATOR, error: e.message });
  } finally {
    if (req.file) req.file.buffer = null;
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌐 UPLOAD FROM URL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get("/upload/url", async (req, res) => {
  noCache(res);
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, code: 400, creator: CREATOR, message: "URL parameter required" });

    const response = await ax.get(`https://ar-hosting.pages.dev/hosturl?url=${encodeURIComponent(url)}`);
    const filename = response.data.url.split("/").pop();
    const base = `${req.protocol}://${req.get("host")}`;

    res.json({
      success: true,
      code: 200,
      creator: "RabbitX CDN",
      result: {
        name: filename,
        size: response.data.size,
        type: response.data.media_type,
        uploaded: response.data.uploaded_on,
        url: `${base}/cdn/${filename}`,
        cdn: `${base}/cdn/${filename}`
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, code: 500, creator: CREATOR, error: e.message });
  }
});

router.get("/cdn/url", async (req, res) => {
  noCache(res);
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, code: 400, creator: CREATOR, message: "URL required" });

    const response = await ax.get(`https://ar-hosting.pages.dev/hosturl?url=${encodeURIComponent(url)}`);
    const filename = response.data.url.split("/").pop();
    const base = `${req.protocol}://${req.get("host")}`;

    res.json({
      success: true,
      code: 200,
      creator: "RabbitX CDN",
      result: {
        name: filename,
        size: response.data.size,
        type: response.data.media_type,
        uploaded: response.data.uploaded_on,
        cdn: `${base}/cdn/${filename}`
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, code: 500, creator: CREATOR, error: e.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📂 CDN FILE PROXY (/file/:file)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get("/file/:file", async (req, res) => {
  noCache(res);
  let stream;
  try {
    const target = `https://cdnfile.pages.dev/${req.params.file}`;
    const response = await axios({ url: target, method: "GET", responseType: "stream", timeout: 30000 });

    stream = response.data;

    if (response.headers["content-type"])   res.setHeader("Content-Type",   response.headers["content-type"]);
    if (response.headers["content-length"]) res.setHeader("Content-Length", response.headers["content-length"]);

    res.setHeader("Accept-Ranges",  "bytes");
    res.setHeader("x-rabbit-cdn",   "RabbitX Edge");
    noCache(res);

    stream.on("end",   () => safeDestroy(stream));
    stream.on("close", () => safeDestroy(stream));
    stream.on("error", () => safeDestroy(stream));
    req.on("close",    () => safeDestroy(stream));
    res.on("finish",   () => safeDestroy(stream));

    stream.pipe(res);
  } catch (e) {
    safeDestroy(stream);
    res.status(404).json({ status: false, creator: CREATOR, message: "File not found" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📂 CDN FILE PROXY (/cdn/:file)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get("/cdn/:file", async (req, res) => {
  noCache(res);
  let stream;
  try {
    const target = `https://ar-hosting.pages.dev/${req.params.file}`;
    const response = await axios({ url: target, method: "GET", responseType: "stream", timeout: 30000, headers: { "User-Agent": "RabbitX-CDN" } });

    stream = response.data;

    if (response.headers["content-type"])   res.setHeader("Content-Type",   response.headers["content-type"]);
    if (response.headers["content-length"]) res.setHeader("Content-Length", response.headers["content-length"]);

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("x-rabbit-cdn",  "RabbitX Edge");
    res.setHeader("x-cache",       "HIT");
    res.removeHeader("x-powered-by");
    noCache(res);

    stream.on("end",   () => safeDestroy(stream));
    stream.on("close", () => safeDestroy(stream));
    stream.on("error", () => safeDestroy(stream));
    req.on("close",    () => safeDestroy(stream));
    res.on("finish",   () => safeDestroy(stream));

    stream.pipe(res);
  } catch (e) {
    safeDestroy(stream);
    res.status(404).json({ success: false, code: 404, creator: CREATOR, message: "File not found" });
  }
});

module.exports = router;
