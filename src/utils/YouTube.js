const { ax } = require("./http");
const { JERRY_HEADERS } = require("../config");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// FAST YOUTUBE SEARCH
// Races yt-search against a second
// source, and caches repeat queries
// so the same song returns instantly
// ━━━━━━━━━━━━━━━━━━━━━━━━━━

const searchCache = new Map();
const SEARCH_CACHE_TTL = 20 * 60 * 1000;

function normalizeVideo(v) {
  return {
    title: v.title,
    url: v.url,
    videoId: v.videoId,
    duration: v.duration || v.timestamp,
    views: v.views,
    uploaded: v.uploaded || v.ago,
    thumbnail: v.thumbnail,
    author: { name: v.author?.name }
  };
}

async function searchViaDanzy(query) {
  const { data } = await ax.get(
    `https://api.danzy.web.id/api/search/yts?q=${encodeURIComponent(query)}`,
    { timeout: 8000 }
  );
  const v = data?.result?.[0];
  if (!data?.status || !v) throw new Error("no result");
  return normalizeVideo(v);
}

async function searchViaRabbit(query) {
  const { data } = await ax.get(
    `https://rabbitapi.nett.to/search/youtube?q=${encodeURIComponent(query)}&limit=1`,
    { timeout: 8000 }
  );
  const v = data?.result?.[0];
  if (!v) throw new Error("no result");
  return normalizeVideo(v);
}

// Direct YouTube scrape — no middleman API at all,
// parses ytInitialData straight off the results page
async function searchViaDirect(query) {
  const { data } = await ax.get("https://www.youtube.com/results", {
    params: { search_query: query },
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    timeout: 8000
  });

  const match = data.match(/var ytInitialData = (.*?);<\/script>/s);
  if (!match) throw new Error("parse failed");

  const ytInitialData = JSON.parse(match[1]);
  const contents = ytInitialData.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
  if (!contents) throw new Error("no contents");

  const section = contents.find(c => c.itemSectionRenderer)?.itemSectionRenderer?.contents;
  if (!section) throw new Error("no section");

  const first = section.find(i => i.videoRenderer && i.videoRenderer.lengthText);
  if (!first) throw new Error("no result");

  const v = first.videoRenderer;

  return {
    title: v.title?.runs?.[0]?.text || "No Title",
    url: `https://youtu.be/${v.videoId}`,
    videoId: v.videoId,
    duration: v.lengthText?.simpleText || null,
    views: v.viewCountText?.simpleText || null,
    uploaded: v.publishedTimeText?.simpleText || null,
    thumbnail: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || null,
    author: { name: null }
  };
}

async function fastYoutubeSearch(query) {
  const key = query.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.time < SEARCH_CACHE_TTL) {
    return cached.video;
  }

  const video = await Promise.any([
    searchViaDanzy(query),
    searchViaRabbit(query),
    searchViaDirect(query)
  ]);

  searchCache.set(key, { video, time: Date.now() });
  return video;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// SONG BACKENDS
// David = primary, Jerry = backup.
// Both /api/song and /api/play call
// getSongResult() so any backend added
// here automatically applies to both.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━

async function fetchSongDavid(url) {
  const { data } = await ax.get(
    `https://apis.davidcyril.name.ng/download/savetube?url=${encodeURIComponent(url)}&format=mp3`,
    { timeout: 10000 }
  );

  if (!data?.success || !data?.data?.download_url) {
    throw new Error("source unavailable");
  }

  return {
    title: data.data.title,
    duration: data.data.duration,
    quality: data.data.quality,
    thumbnail: data.data.cover,
    downloadUrl: data.data.download_url,
    source: "david"
  };
}

async function fetchSongJerry(url) {
  const { data } = await ax.get(
    `https://jerrycoder.oggyapi.workers.dev/down/ytmp3?url=${encodeURIComponent(url)}`,
    { timeout: 15000, headers: JERRY_HEADERS }
  );

  if (data?.status !== "success" || !data?.url) {
    throw new Error("jerry source unavailable");
  }

  return {
    title: data.title,
    duration: data.duration,
    quality: data.quality,
    thumbnail: null,
    downloadUrl: data.url,
    source: "jerry"
  };
}

// Tries each backend in order, first success wins.
// Add more backends here later — just push another
// try/catch step, nothing else needs to change.
async function getSongResult(videoUrl) {
  try {
    return await fetchSongDavid(videoUrl);
  } catch (_) {}

  try {
    return await fetchSongJerry(videoUrl);
  } catch (_) {}

  throw new Error("all sources failed");
}

module.exports = {
  fastYoutubeSearch,
  getSongResult,
  fetchSongDavid,
  fetchSongJerry
};
