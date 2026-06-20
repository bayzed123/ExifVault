
const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB support
});

app.use(express.static(__dirname));

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).send("No asset uploaded.");

  const input = req.file.path;
  const output = input + "_processed";
  
  let meta = {};
  try {
    meta = JSON.parse(req.body.customMetadata);
  } catch (e) {
    meta = {
      make: "Epson",
      model: "Perfection V850 Pro",
      artist: "Bayezid Storyline"
    };
  }

  const scanDate = `${2015 + Math.floor(Math.random() * 9)}:06:20 12:00:00`;
  const serial = Math.random().toString(36).substring(2, 12).toUpperCase();
  const escape = (s) => (s || "").replace(/"/g, '\\"');

  // Hardcoded Bayezid Signature + Deep Cleanse
  const cmd = `exiftool -all= -XMP:all= -IPTC:all= -Photoshop:all= \
    -EXIF:Make="${escape(meta.make)}" \
    -EXIF:Model="${escape(meta.model)}" \
    -EXIF:Artist="${escape(meta.artist)}" \
    -EXIF:Software="VueScan 9" \
    -EXIF:Copyright="© 2026 ${escape(meta.artist)}" \
    -EXIF:DateTimeOriginal="${scanDate}" \
    -EXIF:CreateDate="${scanDate}" \
    -EXIF:SerialNumber="${serial}" \
    -IPTC:By-line="${escape(meta.artist)}" \
    -IPTC:CopyrightNotice="All Rights Reserved. Restored by ${escape(meta.artist)}." \
    -IPTC:ObjectName="Historical Archive" \
    -IPTC:Caption-Abstract="${escape(meta.description || "Historical Archive Restoration")}" \
    -IPTC:Keywords="${escape(meta.keywords || "history, archive, rare")}" \
    -o "${output}" "${input}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error(err);
      if (fs.existsSync(input)) fs.unlinkSync(input);
      return res.status(500).send("Processing Error.");
    }

    res.download(output, `Archive_${req.file.originalname}`, () => {
      if (fs.existsSync(input)) fs.unlinkSync(input);
      if (fs.existsSync(output)) fs.unlinkSync(output);
    });
  });
});

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.listen(port, () => console.log(`Automated Archival Suite active on port ${port}`));
