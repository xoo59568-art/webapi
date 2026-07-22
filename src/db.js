const mongoose = require("mongoose");
const { MONGODB_URI } = require("./config");

async function connectDB() {
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI is not set in config.js");
    throw new Error("MONGODB_URI missing");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(MONGODB_URI);
  console.log("✅ MongoDB connected");

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
  });
}

module.exports = { connectDB };
