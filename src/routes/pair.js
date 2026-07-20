const express = require("express");
const router = express.Router();
const axios = require("axios");
const multer = require("multer");
const { CREATOR } = require("../config");
const { noCache, ax } = require("../utils/http");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.get("/api/pair", async (req, res) => {
  noCache(res);

  try {
    const { number } = req.query;

    if (!number) {
      return res.status(400).json({
        success: false,
        creator: CREATOR,
        message: "Number required"
      });
    }

    // hidden backend request
    const api =
      `http://66.78.41.20:3000/pair/${number}`;

    const response = await axios.get(api, {

      // 3 MINUTE TIMEOUT
      timeout: 180000,

      headers: {
        "User-Agent": "Mozilla/5.0"
      }

    });

    const data = response.data;

    if (!data?.code) {
      return res.status(404).json({
        success: false,
        creator: CREATOR,
        message: "Pair code not found"
      });
    }

    return res.json({
      success: true,
      creator: CREATOR,

      result: {
        number: data.phone || number,
        code: data.code
      }
    });

  } catch (err) {

    if (err.code === "ECONNABORTED") {

      return res.status(408).json({
        success: false,
        creator: CREATOR,
        message: "Request timeout after 3 minutes"
      });

    }

    return res.status(500).json({
      success: false,
      creator: CREATOR,
      error: err.message
    });

  }
});

router.all("/api/fullpp/pair", upload.single("image"), async (req, res) => {
  noCache(res);

  let imageBase64 = null;

  try {
    // number from query or form-data
    const number =
      req.query.number ||
      req.body.number;

    // image URL from query or body
    const imageUrl =
      req.query.url ||
      req.body.url;

    if (!number) {
      return res.status(400).json({
        success: false,
        creator: CREATOR,
        message: "Number required"
      });
    }

    // ─────────────────────────
    // URL MODE
    // GET /api/fullpp/pair?number=9173&url=https://...
    // ─────────────────────────
    if (imageUrl) {
      const img = await ax.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 30000
      });

      const type =
        img.headers["content-type"] ||
        "image/jpeg";

      imageBase64 =
        `data:${type};base64,` +
        Buffer.from(img.data).toString("base64");
    }

    // ─────────────────────────
    // UPLOAD MODE
    // POST /api/fullpp/pair
    // form-data:
    // number=9173
    // image=@photo.jpg
    // ─────────────────────────
    else if (req.file) {
      imageBase64 =
        `data:${req.file.mimetype};base64,` +
        req.file.buffer.toString("base64");
    }

    else {
      return res.status(400).json({
        success: false,
        creator: CREATOR,
        message: "URL or image file required"
      });
    }

    // Send to upstream API
    const { data } = await ax.post(
      "https://wpfullpp.zone.id/api/pair",
      {
        phone: number,
        imageBase64
      },
      {
        timeout: 180000,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    return res.json({
      success: true,
      creator: CREATOR,
      result: data
    });

  } catch (e) {
    return res.status(500).json({
      success: false,
      creator: CREATOR,
      error: e.message
    });
  } finally {
    imageBase64 = null;

    if (req.file) {
      req.file.buffer = null;
      req.file = null;
    }
  }
});

module.exports = router;
