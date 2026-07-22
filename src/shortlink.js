const path = require("path");
const Link = require("../models/Link");

// Avoids visually-confusing characters (0/O, 1/l/I)
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function randomCode(len = 5) {
  let code = "";
  for (let i = 0; i < len; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

function extractExtension(url) {
  try {
    const { pathname } = new URL(url);
    const ext = path.extname(pathname); // e.g. ".mp4", ".jpg" — includes the dot
    return ext || "";
  } catch {
    return "";
  }
}

/**
 * Returns an existing "12hsy.mp4"-style filename for this URL if we've
 * shortened it before, otherwise generates a fresh unique one and stores it.
 * The random part is 5 chars; the extension is copied from the real URL.
 */
async function getOrCreateFilename(realUrl) {
  const existing = await Link.findOne({ url: realUrl }).lean();
  if (existing) return existing.code;

  const ext = extractExtension(realUrl);
  let filename;
  let attempts = 0;

  do {
    filename = randomCode(5) + ext;
    attempts++;
    if (attempts > 15) throw new Error("Could not generate a unique filename");
  } while (await Link.exists({ code: filename }));

  await Link.create({ code: filename, url: realUrl });
  return filename;
}

/**
 * Turns any external URL into "https://mydomain.com/12hsy.mp4"
 */
async function shortenLink(req, realUrl) {
  if (!realUrl) return null;

  const filename = await getOrCreateFilename(realUrl);
  const base = `${req.protocol}://${req.get("host")}`;
  return `${base}/${filename}`;
}

module.exports = { shortenLink, randomCode };
