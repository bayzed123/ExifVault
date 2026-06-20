
const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 },
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
    return res.status(400).send("Invalid metadata.");
  }

  const escape = (s) => (s || "").replace(/"/g, '\\"');
  
  // Build the ExifTool command dynamically based on provided tags
  let exifArgs = ["-all=", "-XMP:all=", "-IPTC:all=", "-Photoshop:all="];
  
  // Mapping frontend tag names to ExifTool tag names
  const tagMap = {
    "Make": "EXIF:Make",
    "Model": "EXIF:Model",
    "Artist": "EXIF:Artist",
    "Software": "EXIF:Software",
    "Copyright": "EXIF:Copyright",
    "By-line": "IPTC:By-line",
    "CopyrightNotice": "IPTC:CopyrightNotice",
    "ObjectName": "IPTC:ObjectName",
    "Caption-Abstract": "IPTC:Caption-Abstract",
    "Keywords": "IPTC:Keywords",
    // Advanced/C2PA/JUMD (simulated via XMP or custom tags if supported)
    "JUMDType": "XMP:JUMDType",
    "JUMDLabel": "XMP:JUMDLabel",
    "C2PAActionsV2Salt": "XMP:C2PAActionsV2Salt",
    "ActionsAction": "XMP:ActionsAction",
    "ActionsSoftwareAgentName": "XMP:ActionsSoftwareAgentName",
    "InstanceID": "XMP:InstanceID",
    "Title": "XMP:Title",
    "Category": "IPTC:Category"
  };

  for (let [key, value] of Object.entries(meta)) {
    if (value) {
      const exifTag = tagMap[key] || `XMP:${key}`; // Default to XMP if not in map
      exifArgs.push(`-${exifTag}="${escape(value)}"`);
    }
  }

  // Add default archival randomization if not manually set
  if (!meta.DateTimeOriginal) {
    const scanDate = `${2015 + Math.floor(Math.random() * 9)}:06:20 12:00:00`;
    exifArgs.push(`-EXIF:DateTimeOriginal="${scanDate}"`);
    exifArgs.push(`-EXIF:CreateDate="${scanDate}"`);
  }
  if (!meta.SerialNumber) {
    const serial = Math.random().toString(36).substring(2, 12).toUpperCase();
    exifArgs.push(`-EXIF:SerialNumber="${serial}"`);
  }

  const cmd = `exiftool ${exifArgs.join(" ")} -o "${output}" "${input}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error(err);
      if (fs.existsSync(input)) fs.unlinkSync(input);
      return res.status(500).send("Archival Processing Error.");
    }

    res.download(output, `Archive_${req.file.originalname}`, () => {
      if (fs.existsSync(input)) fs.unlinkSync(input);
      if (fs.existsSync(output)) fs.unlinkSync(output);
    });
  });
});

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.listen(port, () => console.log(`Curator Dashboard active on port ${port}`));
