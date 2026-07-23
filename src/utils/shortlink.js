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

// Strips anything that isn't safe in a URL path segment / filename
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "").replace(/\.{2,}/g, ".");
}

/**
 * Returns an existing "12hsy.mp4"-style filename for this URL if we've
 * shortened it before, otherwise generates a fresh unique one and stores it.
 *
 * If customName is given, it's used as the base filename instead of a
 * random one (the real extension is appended if customName doesn't
 * already include one). Throws if that name is already taken by a
 * different URL.
 */
async function getOrCreateFilename(realUrl, customName) {
  const existing = await Link.findOne({ url: realUrl }).lean();
  if (existing && !customName) return existing.code;

  const ext = extractExtension(realUrl);

  if (customName) {
    let filename = sanitizeName(customName);
    if (!filename) throw new Error("Invalid custom name");
    if (!path.extname(filename)) filename += ext;

    const taken = await Link.findOne({ code: filename }).lean();
    if (taken) {
      if (taken.url === realUrl) return filename; // already points to the same file
      throw new Error(`Name "${filename}" is already taken`);
    }

    await Link.create({ code: filename, url: realUrl });
    return filename;
  }

  // No custom name -> random 5-char code
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
 * (or "https://mydomain.com/mycustomname.mp4" if customName is given)
 */
async function shortenLink(req, realUrl, customName) {
  if (!realUrl) return null;

  const filename = await getOrCreateFilename(realUrl, customName);
  const base = `${req.protocol}://${req.get("host")}`;
  return `${base}/${filename}`;
}

module.exports = { shortenLink, randomCode };
