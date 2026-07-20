const axios = require("axios");
const http = require("http");
const https = require("https");
const dns = require("dns");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTTPS AGENT — no keepAlive
// (used only for the screenshot tool,
// which hits arbitrary one-off sites)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
const ssAgent = new https.Agent({
  keepAlive: false,
  maxSockets: 10,
  maxFreeSockets: 0,
  timeout: 30000
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// KEEP-ALIVE AGENTS — for all
// other outbound API calls.
// Reuses TCP/TLS connections to the
// same upstream host instead of
// renegotiating on every request —
// meaningfully faster under load.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
const keepAliveHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 30000
});
const keepAliveHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 30000
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// DNS CACHE — skips a fresh DNS
// lookup on every outbound call to
// the same upstream host
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
const dnsCache = new Map();
const DNS_TTL = 5 * 60 * 1000;

function cachedLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  const hit = dnsCache.get(hostname);
  if (hit && Date.now() - hit.time < DNS_TTL) {
    return callback(null, hit.address, hit.family);
  }

  dns.lookup(hostname, options, (err, address, family) => {
    if (!err) dnsCache.set(hostname, { address, family, time: Date.now() });
    callback(err, address, family);
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// AXIOS DEFAULT CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
const ax = axios.create({
  timeout: 30000,
  headers: { "User-Agent": "Mozilla/5.0" },
  maxRedirects: 5,
  decompress: true,
  httpsAgent: keepAliveHttpsAgent,
  httpAgent: keepAliveHttpAgent,
  lookup: cachedLookup
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// NO-CACHE HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
function noCache(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// STREAM DESTROY HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
function safeDestroy(stream) {
  try {
    if (stream && !stream.destroyed) stream.destroy();
  } catch (_) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONNECTION WARM-UP
// Opens/keeps a socket ready to the
// most frequently used backends so
// real requests don't pay the cold
// TLS handshake cost.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━
const WARM_HOSTS = [
  "https://apis.davidcyril.name.ng",
  "https://jerrycoder.oggyapi.workers.dev",
  "https://api.danzy.web.id",
  "https://ar-hosting.pages.dev"
];

function warmConnections() {
  WARM_HOSTS.forEach(host => {
    ax.get(host, { timeout: 5000 }).catch(() => {});
  });
}

module.exports = {
  ax,
  ssAgent,
  keepAliveHttpsAgent,
  keepAliveHttpAgent,
  cachedLookup,
  noCache,
  safeDestroy,
  warmConnections
};
