/*
 * Backend integration adapted from rabbitxmd.
 * Do not remove the original creator's credit above.
 */

const axios = require("axios");
const crypto = require("crypto");
const FormData = require("form-data");

const dataStore = new Map();

const Encoder = {
  async enc({ data, method }) {
    if (method === "combined") {
      const uuid = crypto.randomUUID();
      dataStore.set(uuid, data);
      if (dataStore.size > 1000) {
        const keys = Array.from(dataStore.keys());
        for (let i = 0; i < keys.length - 1000; i++) dataStore.delete(keys[i]);
      }
      return { uuid };
    }
  },
  async dec({ uuid, method }) {
    if (method === "combined") {
      const data = dataStore.get(uuid);
      if (!data) throw new Error(`Data not found for UUID: ${uuid}`);
      return { text: data };
    }
  }
};

const genRandHash = () => {
  const hex = "0123456789abcdef";
  return Array.from({ length: 16 }, () => hex[Math.random() < .05 ? 10 : Math.floor(Math.random() * 16)]).join("");
};

class GhibliGenerator {
  constructor() {
    this._BASE_URL = "https://be.aimirror.fun";
    this._UID = genRandHash();
    this._hash = "";
    this._imageKey = "";
    this._HEADERS = {
      "User-Agent": "AIMirror/6.8.4+179 (android)",
      store: "googleplay",
      uid: this._UID,
      env: "PRO",
      "accept-language": "en",
      "accept-encoding": "gzip",
      "package-name": "com.ai.polyverse.mirror",
      host: "be.aimirror.fun",
      "content-type": "application/json",
      "app-version": "6.8.4+179"
    };
  }

  async enc(data) {
    const { uuid } = await Encoder.enc({ data, method: "combined" });
    return uuid;
  }

  async dec(uuid) {
    const { text } = await Encoder.dec({ uuid, method: "combined" });
    return text;
  }

  _s1(str) {
    return crypto.createHash("sha1").update(str, "utf8").digest("hex");
  }

  async _downloadImage(imageUrl) {
    if (Buffer.isBuffer(imageUrl)) return imageUrl;
    const res = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 60000 });
    return Buffer.from(res.data);
  }

  async _getToken() {
    const url = `${this._BASE_URL}/app_token/v2`;
    const params = { cropped_image_hash: `${this._hash}.jpg`, uid: this._UID };
    const res = await axios.get(url, { params, headers: this._HEADERS, timeout: 10000 });
    return res.data;
  }

  async _upload(buffer, token) {
    const body = new FormData();
    body.append("name", "ghibli.jpg");
    body.append("key", token.key);
    body.append("policy", token.policy);
    body.append("OSSAccessKeyId", token.OSSAccessKeyId);
    body.append("success_action_status", "200");
    body.append("signature", token.signature);
    body.append("backend_type", "OSS");
    body.append("region", "ap-south-1");
    body.append("file", buffer, { filename: `${this._hash}.jpg`, contentType: "application/octet-stream" });
    await axios.post(token.upload_host, body, {
      headers: { ...body.getHeaders(), "User-Agent": "Dart/3.6 (dart:io)", "Accept-Encoding": "gzip" },
      maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 30000
    });
  }

  async _draw(model_id = 204) {
    const url = `${this._BASE_URL}/draw?uid=${this._UID}`;
    const data = {
      model_id, cropped_image_key: this._imageKey,
      cropped_height: 1024, cropped_width: 768,
      package_name: "com.ai.polyverse.mirror",
      ext_args: { imagine_value2: 50, custom_prompt: "" },
      version: "6.8.4", force_default_pose: true, is_free_trial: true
    };
    const res = await axios.post(url, data, { headers: this._HEADERS, timeout: 20000, validateStatus: () => true });
    return res.data;
  }

  async _pollStatus(drawRequestId) {
    const url = `${this._BASE_URL}/draw/process`;
    const res = await axios.get(url, {
      headers: this._HEADERS,
      params: { draw_request_id: drawRequestId, uid: this._UID },
      timeout: 15000
    });
    return res.data;
  }

  // imageInput can be a URL string OR a Buffer (uploaded file bytes)
  async generate(imageInput) {
    this._hash = this._s1(crypto.randomUUID());
    const buffer = await this._downloadImage(imageInput);
    const token = await this._getToken();
    this._imageKey = token.key;
    await this._upload(buffer, token);
    const drawRes = await this._draw();
    const reqId = drawRes.draw_request_id;
    if (!reqId) throw new Error("Failed to get draw_request_id");
    const taskId = await this.enc({ reqId, uid: this._UID, headers: this._HEADERS, hash: this._hash, imgKey: this._imageKey });
    return { task_id: taskId, reqId };
  }

  async status(taskId) {
    const { reqId, uid, headers, hash, imgKey } = await this.dec(taskId);
    this._UID = uid;
    this._hash = hash;
    this._imageKey = imgKey;
    this._HEADERS = headers;
    const data = await this._pollStatus(reqId);
    return {
      status: data.draw_status || "UNKNOWN",
      progress: data.progress?.process || 0,
      images: data.generated_image_addresses || null,
      msg: data.msg || "OK"
    };
  }
}

// Runs the full generate -> poll -> done cycle and returns the final image buffer.
// pollAttempts * pollDelayMs = max wait time (default 30 * 3s = 90s).
async function generateGhibliBuffer(imageInput, { pollAttempts = 30, pollDelayMs = 3000 } = {}) {
  const client = new GhibliGenerator();
  const { task_id } = await client.generate(imageInput);

  let finalResult = null;
  for (let attempt = 0; attempt < pollAttempts; attempt++) {
    await new Promise(r => setTimeout(r, pollDelayMs));
    const st = await client.status(task_id);
    if (st.status === "SUCCEED") { finalResult = st; break; }
    if (st.status === "FAILED") throw new Error(st.msg || "Generation failed");
  }

  if (!finalResult?.images?.length) {
    throw new Error("Timed out waiting for Ghibli image");
  }

  const imgRes = await axios.get(finalResult.images[0], { responseType: "arraybuffer", timeout: 30000 });
  return {
    buffer: Buffer.from(imgRes.data),
    contentType: imgRes.headers["content-type"] || "image/jpeg"
  };
}

module.exports = { GhibliGenerator, generateGhibliBuffer };
