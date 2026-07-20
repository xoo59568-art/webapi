const axios = require("axios");
const crypto = require("crypto");
const FormData = require("form-data");

function generateClientId(length = 40) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// input: either an image URL (string) or an already-downloaded Buffer.
// If a Buffer is passed, mimeType must be provided (from the upload's req.file.mimetype).
async function removeBgViaMagicStudio(input, mimeType = "image/jpeg") {
  let dataUri;

  if (Buffer.isBuffer(input)) {
    dataUri = `data:${mimeType};base64,${input.toString("base64")}`;
  } else {
    const imageResponse = await axios.get(input, { responseType: "arraybuffer", timeout: 30000 });
    const buffer = Buffer.from(imageResponse.data);
    const contentType = imageResponse.headers["content-type"] || "image/jpeg";
    dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  const anonymousUserId = crypto.randomUUID();
  const requestTimestamp = (Date.now() / 1000).toFixed(3);
  const clientId = generateClientId();

  const form = new FormData();
  form.append("image", dataUri);
  form.append("output_type", "image");
  form.append("output_format", "url");
  form.append("auto_delete_data", "true");
  form.append("user_profile_id", "null");
  form.append("anonymous_user_id", anonymousUserId);
  form.append("request_timestamp", requestTimestamp);
  form.append("user_is_subscribed", "false");
  form.append("client_id", clientId);

  const apiRes = await axios.post("https://ai-api.magicstudio.com/api/remove-background", form, {
    headers: {
      ...form.getHeaders(),
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "origin": "https://magicstudio.com",
      "referer": "https://magicstudio.com/background-remover/editor/"
    },
    timeout: 60000
  });

  if (!apiRes.data || apiRes.data.status !== "success" || !apiRes.data.results) {
    throw new Error("API format invalid or background removal failed.");
  }

  const resultUrl = apiRes.data.results[0].image;
  const finalImageResponse = await axios.get(resultUrl, { responseType: "arraybuffer", timeout: 30000 });

  return {
    buffer: Buffer.from(finalImageResponse.data),
    contentType: "image/png"
  };
}

module.exports = { removeBgViaMagicStudio };
