const express = require("express");
const router = express.Router();
const cheerio = require("cheerio");
const gis = require("g-i-s");
const { CREATOR } = require("../config");
const { noCache, ax } = require("../utils/http");
const { cacheMedia } = require("../utils/cache");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ▶️ YOUTUBE SEARCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get("/search/youtube", async (req, res) => {
  noCache(res);
  try {
    const { query, q, limit } = req.query;
    const searchQuery = query || q;
    const searchLimit = parseInt(limit) || 10;

    if (!searchQuery) return res.status(400).json({
      status: false, creator: CREATOR, message: "Enter query",
      example: "/search/youtube?q=alan walker&limit=5"
    });

    const { data } = await ax.get(
      `https://api.danzy.web.id/api/search/yts?q=${encodeURIComponent(searchQuery)}`,
      { timeout: 15000 }
    );

    if (!data?.status || !Array.isArray(data.result) || !data.result.length) {
      return res.status(404).json({
        status: false,
        creator: CREATOR,
        message: "No results found"
      });
    }

    const videos = data.result.slice(0, searchLimit).map((v, i) => ({
      id: i + 1,
      title: v.title,
      url: v.url,
      videoId: v.videoId,
      duration: v.duration,
      views: v.views,
      uploaded: v.uploaded,
      thumbnail: cacheMedia(req, v.thumbnail, ".jpg"),
      author: { name: null, url: null }
    }));

    res.json({
      status: true,
      creator: CREATOR,
      query: searchQuery,
      total: videos.length,
      limit: searchLimit,
      result: videos
    });
  } catch (e) {
    res.status(500).json({ status: false, creator: CREATOR, message: "Search failed" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🖼️ IMAGE SEARCH (single route)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function googleScrape(query, limit = 10) {
  const { data } = await ax.get(
    `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,
    { timeout: 5000 }
  );
  const $ = cheerio.load(data);
  const results = [];
  $("img").each((_, el) => {
    const img = $(el).attr("src");
    if (img && img.startsWith("http") && !results.includes(img)) results.push(img);
  });
  return results.slice(0, limit);
}

function gisSearch(query, limit = 10) {
  return new Promise((resolve, reject) => {
    gis(query, (err, results) => {
      if (err) return reject(err);
      resolve(results.map(v => v.url).filter(v => v && v.startsWith("http")).slice(0, limit));
    });
  });
}

router.get("/api/image", async (req, res) => {
  noCache(res);
  try {
    const { q, query, limit } = req.query;
    const searchQ = q || query;
    if (!searchQ) return res.status(400).json({ status: false, creator: CREATOR, message: "Query required" });

    let result = [];
    let source = "google-scrape";

    try {
      result = await googleScrape(searchQ, Number(limit) || 10);
      if (!result.length) throw new Error("No results");
    } catch {
      source = "gis-fallback";
      result = await gisSearch(searchQ, Number(limit) || 10);
    }

    res.json({
      status: true,
      creator: CREATOR,
      query: searchQ,
      source,
      total: result.length,
      result
    });
  } catch (e) {
    res.status(500).json({ status: false, creator: CREATOR, error: e.message });
  }
});

module.exports = router;
