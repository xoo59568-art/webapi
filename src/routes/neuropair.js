const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const {
  sessions,
  inProgress,
  connectWA,
  cleanDir,
  cleanTemp,
  TEMP_DIR,
  SESSIONS_DIR,
} = require("../utils/waPairEngine");

// ═══════════════════════════════════════════════════════════════
//  NeuroBot Web — WhatsApp pairing (Baileys, self-hosted)
//
//  POST /api/neuropair/pair      { phone, imageBase64 }  → { pair_code }
//  GET  /api/neuropair/status/:phone                     → { status, connected }
//  POST /api/neuropair/cancel    { phone }                → { ok }
// ═══════════════════════════════════════════════════════════════

router.post("/api/neuropair/pair", async (req, res) => {
  const { phone: rawPhone, imageBase64 } = req.body || {};

  if (!rawPhone || !imageBase64)
    return res.status(400).json({ success: false, error: "phone aur imageBase64 chahiye" });

  const phone = String(rawPhone).replace(/\D/g, "");
  if (phone.length < 7 || phone.length > 15)
    return res.status(400).json({ success: false, error: "Invalid phone number" });

  if (inProgress.has(phone))
    return res.status(429).json({ success: false, error: "Already processing — thoda ruko" });

  inProgress.add(phone);

  // Save base64 image to temp
  const photoPath = path.join(TEMP_DIR, phone + "_upload.jpg");
  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(photoPath, Buffer.from(base64Data, "base64"));
  } catch (e) {
    inProgress.delete(phone);
    return res.status(400).json({ success: false, error: "Image save failed: " + e.message });
  }

  // Kill old session
  const old = sessions.get(phone);
  if (old) {
    old.finished = true;
    try { old.sock && old.sock.end(); } catch (_) {}
    sessions.delete(phone);
  }
  cleanDir(phone);
  fs.mkdirSync(path.join(SESSIONS_DIR, phone), { recursive: true });

  const shared = {
    sock: null,
    photoPath,
    codeSent: false,
    pairCode: null,
    connected: false,
    finished: false,
    dpDone: false,
    status: "connecting", // connecting → waiting_user → connected → setting_dp → done/error
    error: null,
    _authRetried: false,
    _401retried: false,
    resolve: null,
    reject: null,
  };
  sessions.set(phone, shared);

  try {
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!shared.connected) {
          shared.finished = true;
          shared.status = "error";
          shared.error = "Timeout";
          sessions.delete(phone);
          cleanDir(phone);
          reject(new Error("Timeout: 35s me pair code nahi mila"));
        }
      }, 35000);
      shared.resolve = code => { clearTimeout(timer); resolve(code); };
      shared.reject = err => { clearTimeout(timer); reject(err); };
      connectWA(phone, photoPath, shared);
    });

    inProgress.delete(phone);
    return res.json({ success: true, pair_code: code, phone: "+" + phone });

  } catch (e) {
    inProgress.delete(phone);
    cleanTemp(photoPath);
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/api/neuropair/status/:phone", (req, res) => {
  const phone = String(req.params.phone).replace(/\D/g, "");
  const shared = sessions.get(phone);
  if (!shared) return res.json({ status: "idle", phone });
  return res.json({
    status: shared.status,
    connected: shared.connected,
    finished: shared.finished,
    dpDone: shared.dpDone,
    error: shared.error,
    phone,
  });
});

router.post("/api/neuropair/cancel", (req, res) => {
  const phone = String((req.body || {}).phone || "").replace(/\D/g, "");
  const shared = sessions.get(phone);
  if (shared) {
    shared.finished = true;
    shared.status = "cancelled";
    try { shared.sock && shared.sock.end(); } catch (_) {}
    sessions.delete(phone);
    cleanDir(phone);
    cleanTemp(shared.photoPath);
    inProgress.delete(phone);
  }
  res.json({ ok: true });
});

module.exports = router;
