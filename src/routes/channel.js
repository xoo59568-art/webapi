const express = require("express");
const router = express.Router();
const axios = require("axios");
const { CREATOR } = require("../config");
const { noCache } = require("../utils/http");

// channel react (apikey-gated)
router.get("/api/chr", async (req, res) => {
  noCache(res);

  try {
    const { apikey, url, react } = req.query;

    // API KEY REQUIRED
    if (!apikey) {
      return res.status(401).json({
        success: false,
        creator: CREATOR,
        message: "API key required"
      });
    }

    // LOAD KEYS FROM GITHUB
    const { data } = await axios.get(
      "https://raw.githubusercontent.com/xoo59568-art/newapi/refs/heads/main/database/apikeys.txt",
      {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const keys = data
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean);

    // CHECK API KEY
    if (!keys.includes(apikey)) {
      return res.status(403).json({
        success: false,
        creator: CREATOR,
        message: "Invalid API key"
      });
    }

    // PARAM CHECK
    if (!url) {
      return res.status(400).json({
        success: false,
        creator: CREATOR,
        message: "Channel URL required"
      });
    }

    if (!react) {
      return res.status(400).json({
        success: false,
        creator: CREATOR,
        message: "Reaction required"
      });
    }

    // BACKEND REQUEST
    const api =
      `http://66.78.41.20:3000/api/chr?url=${encodeURIComponent(url)}&react=${encodeURIComponent(react)}`;

    const response = await axios.get(api, {
      timeout: 180000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    return res.json({
      success: true,
      creator: CREATOR,
      result: response.data
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

// socket-fanout channel react
router.get("/api/channel/react", async (req, res) => {
  noCache(res);
  try {
    const { url, react } = req.query;
    if (!url || !react) return res.json({ status: false });

    const reacts = react.split(",");
    let totalSuccess = 0;
    const nodes = [];

    const promises = [...global.botSockets.values()].map(bot => {
      return new Promise(resolve => {
        bot.socket.emit("channel_react", { url, reacts }, (response) => {
          const success = response?.success || 0;
          totalSuccess += success;
          nodes.push({ node: bot.node, success });
          resolve();
        });
      });
    });

    await Promise.all(promises);

    res.json({ status: totalSuccess > 0, total_success: totalSuccess, nodes, channel: url });
  } catch (e) {
    res.json({ status: false, error: e.message });
  }
});

module.exports = router;
