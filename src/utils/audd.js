const axios = require("axios");
const FormData = require("form-data");

const AUDD_TOKEN = "39cd89f5df6ee082fceeb72221e032ef";

// input: either a media URL (string) or an already-downloaded Buffer.
async function identifySong(input, mimeType = "audio/mpeg") {
  const form = new FormData();
  form.append("api_token", AUDD_TOKEN);
  form.append("return", "apple_music,spotify");

  if (Buffer.isBuffer(input)) {
    form.append("file", input, { filename: "audio.mp3", contentType: mimeType });
  } else {
    form.append("url", input);
  }

  const { data } = await axios.post("https://api.audd.io/", form, {
    headers: form.getHeaders(),
    timeout: 20000
  });

  if (data.status === "error") {
    throw new Error(data.error?.error_message || "Failed to identify song.");
  }
  if (!data.result) {
    throw new Error("Song not found.");
  }

  const s = data.result;
  return {
    title: s.title,
    artist: s.artist,
    album: s.album || null,
    release_date: s.release_date || null,
    label: s.label || null,
    timecode: s.timecode || null,
    song_link: s.song_link || null,
    spotify: s.spotify
      ? {
          name: s.spotify.name,
          artist: s.spotify.artists?.[0]?.name,
          url: s.spotify.external_urls?.spotify,
          preview_url: s.spotify.preview_url || null,
          cover: s.spotify.album?.images?.[0]?.url || null
        }
      : null,
    apple_music: s.apple_music
      ? {
          name: s.apple_music.name,
          artist: s.apple_music.artistName,
          url: s.apple_music.url,
          preview_url: s.apple_music.previews?.[0]?.url || null,
          cover: s.apple_music.artwork?.url
            ? s.apple_music.artwork.url.replace("{w}x{h}bb", "1000x1000bb")
            : null
        }
      : null
  };
}

module.exports = { identifySong };
