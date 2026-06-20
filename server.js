
const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

// High-performance upload config (50MB)
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(express.static(__dirname));

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).send("Missing asset.");

  const input = req.file.path;
  const output = input + "_archived";
  
  let meta = {};
  try { meta = JSON.parse(req.body.customMetadata); } catch (e) { return res.status(400).send("Invalid metadata."); }

  // Advanced Museum-Grade Randomization
  const scanDate = `${2015 + Math.floor(Math.random() * 9)}:${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}:${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')} 12:00:00`;
  const serial = Math.random().toString(36).substring(2, 12).toUpperCase();
  const escape = (s) => (s || "").replace(/"/g, '\\"');

  // Deep Cleansing + Signature Injection
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
    -IPTC:CopyrightNotice="All Rights Reserved. Curated by ${escape(meta.artist)}." \
    -IPTC:Caption-Abstract="${escape(meta.description)}" \
    -IPTC:Keywords="${escape(meta.keywords)}" \
    -o "${output}" "${input}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error(err);
      fs.unlinkSync(input);
      return res.status(500).send("Archival error.");
    }

    res.download(output, `Archive_${req.file.originalname}`, () => {
      fs.unlinkSync(input);
      fs.unlinkSync(output);
    });
  });
});

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.listen(port, () => console.log(`Museum Suite active on port ${port}`));
