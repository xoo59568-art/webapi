const CREATOR = "𓋜 -𝐑ᴀ፝֟፝֟ʙʙɪᴛ/>𝟑ن𓂃";

// Browser-like headers for calls to jerrycoder.oggyapi.workers.dev —
// some Cloudflare-protected workers block plain "axios/Mozilla" UAs
// or requests missing Referer/Origin, so we mimic a real browser.
const JERRY_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://jerrycoder.oggyapi.workers.dev/",
  "Origin": "https://jerrycoder.oggyapi.workers.dev"
};

const PORT = process.env.PORT || 4000;

const MONGODB_URI = "mongodb+srv://username:password@cluster.mongodb.net/dbname";

module.exports = { CREATOR, JERRY_HEADERS, PORT, MONGODB_URI };
