const express = require("express");
const router = express.Router();
const multer = require("multer");
const FormData = require("form-data");
const { CREATOR } = require("../config");
const { noCache, ax } = require("../utils/http");
const { shortenLink } = require("../utils/shortlink");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🐇 THE ONLY UPLOAD ENDPOINT: /api/upload
//    - POST /api/upload  (multipart "file" field)  -> random hosting backend
//    - GET  /api/upload?url=...                    -> upload-from-url
//    - POST /api/upload  (body: { url })           -> upload-from-url
//    Response never reveals which backend was used. Every link returned
//    is a short "/xxxxx.ext" URL streamed live by proxy.js — no redirect.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PROVIDERS = ["ar-hosting", "cdnfile"];
const pickProvider = () => PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)];

async function uploadFileToArHosting(file) {
  const form = new FormData();
  form.append("file", file.buffer, { filename: file.originalname, contentType: file.mimetype });

  const { data } = await ax.post("https://ar-hosting.pages.dev/upload", form, {
    headers: { ...form.getHeaders() },
    timeout: 120000,
    maxBodyLength: Infinity
  });

  return {
    realUrl: data.url,
    size: data.size,
    type: data.media_type,
    uploaded: data.uploaded_on
  };
}

async function uploadFileToCdnfile(file) {
  const form = new FormData();
  form.append("file", file.buffer, file.originalname);

  const { data } = await ax.post("https://cdnfile.pages.dev/upload", form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity
  });

  return {
    realUrl: data.url,
    size: file.size || null,
    type: file.mimetype || null,
    uploaded: new Date().toISOString()
  };
}

async function uploadUrlToArHosting(url) {
  const { data } = await ax.get(`https://ar-hosting.pages.dev/hosturl?url=${encodeURIComponent(url)}`);
  return {
    realUrl: data.url,
    size: data.size,
    type: data.media_type,
    uploaded: data.uploaded_on
  };
}

router.all("/api/upload", upload.single("file"), async (req, res) => {
  noCache(res);
  const url = req.query.url || (req.body && req.body.url);

  try {
    let result;

    if (req.file) {
      // ── File upload: pick a random backend, never expose which one ──
      const provider = pickProvider();
      result = provider === "ar-hosting"
        ? await uploadFileToArHosting(req.file)
        : await uploadFileToCdnfile(req.file);

    } else if (url) {
      // ── Upload from URL ──
      result = await uploadUrlToArHosting(url);

    } else {
      return res.status(400).json({
        success: false,
        code: 400,
        creator: CREATOR,
        message: "Provide a file (multipart 'file' field) or a ?url= parameter"
      });
    }

    const shortUrl = await shortenLink(req, result.realUrl);

    return res.json({
      success: true,
      code: 200,
      creator: CREATOR,
      result: {
        size: result.size,
        type: result.type,
        uploaded: result.uploaded,
        url: shortUrl,
        cdn: shortUrl
      }
    });

  } catch (e) {
    return res.status(500).json({ success: false, code: 500, creator: CREATOR, error: e.message });
  } finally {
    if (req.file) req.file.buffer = null;
  }
});

module.exports = router;
