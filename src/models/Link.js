const mongoose = require("mongoose");

const linkSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  url:  { type: String, required: true, index: true },
  hits: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Link", linkSchema);
