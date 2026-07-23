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

// Backends that accept a raw file upload
const FILE_PROVIDERS = ["ar-hosting", "cdnfile", "nekohime", "catbox"];
const pickFileProvider = () => FILE_PROVIDERS[Math.floor(Math.random() * FILE_PROVIDERS.length)];

// Backends that can fetch a remote URL on our behalf
const URL_PROVIDERS = ["ar-hosting", "catbox"];
const pickUrlProvider = () => URL_PROVIDERS[Math.floor(Math.random() * URL_PROVIDERS.length)];

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

async function uploadFileToNekohime(file) {
  const form = new FormData();
  form.append("file", file.buffer, file.originalname);

  const { data } = await ax.post("https://cdn.nekohime.site/upload", form, {
    headers: form.getHeaders(),
    timeout: 60000,
    maxBodyLength: Infinity
  });

  const uploaded = data?.files?.[0];
  if (!uploaded?.url) throw new Error("Nekohime upload failed");

  return {
    realUrl: uploaded.url,
    size: file.size || null,
    type: file.mimetype || null,
    uploaded: new Date().toISOString()
  };
}

async function uploadFileToCatbox(file) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", file.buffer, file.originalname);

  const { data } = await ax.post("https://catbox.moe/user/api.php", form, {
    headers: form.getHeaders(),
    timeout: 60000,
    maxBodyLength: Infinity
  });

  const realUrl = typeof data === "string" ? data.trim() : "";
  if (!realUrl.startsWith("http")) throw new Error("Catbox upload failed: " + realUrl);

  return {
    realUrl,
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

async function uploadUrlToCatbox(url) {
  const form = new FormData();
  form.append("reqtype", "urlupload");
  form.append("url", url);

  const { data } = await ax.post("https://catbox.moe/user/api.php", form, {
    headers: form.getHeaders(),
    timeout: 60000
  });

  const realUrl = typeof data === "string" ? data.trim() : "";
  if (!realUrl.startsWith("http")) throw new Error("Catbox url-upload failed: " + realUrl);

  return { realUrl, size: null, type: null, uploaded: new Date().toISOString() };
}

async function uploadFile(file) {
  const provider = pickFileProvider();
  switch (provider) {
    case "ar-hosting": return uploadFileToArHosting(file);
    case "cdnfile":    return uploadFileToCdnfile(file);
    case "nekohime":   return uploadFileToNekohime(file);
    case "catbox":     return uploadFileToCatbox(file);
  }
}

async function uploadUrl(url) {
  const provider = pickUrlProvider();
  switch (provider) {
    case "ar-hosting": return uploadUrlToArHosting(url);
    case "catbox":     return uploadUrlToCatbox(url);
  }
}

router.all("/api/upload", upload.single("file"), async (req, res) => {
  noCache(res);
  const url = req.query.url || (req.body && req.body.url);
  const customName = req.query.name || (req.body && req.body.name);

  try {
    let result;

    if (req.file) {
      result = await uploadFile(req.file);
    } else if (url) {
      result = await uploadUrl(url);
    } else {
      return res.status(400).json({
        success: false,
        code: 400,
        creator: CREATOR,
        message: "Provide a file (multipart 'file' field) or a ?url= parameter"
      });
    }

    const shortUrl = await shortenLink(req, result.realUrl, customName);

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
