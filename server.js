const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

// Ensure directories exist
const uploadDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "outputs");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(express.static(__dirname));
app.use(express.json());

/**
 * Phase 1 & 2: Pixel Disruption & Dynamic Analysis
 */
app.post("/analyze", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).send("No image uploaded.");

  const inputPath = req.file.path;
  const alteredPath = inputPath + "_altered.jpg";

  try {
    // Phase 1: Watermark Disruption (Pixel Lattice Alteration)
    // 1% dimension resize or 1px crop + 98% quality re-compression
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Apply 1px crop to disrupt lattice
    await image
      .extract({ left: 0, top: 0, width: metadata.width - 1, height: metadata.height - 1 })
      .jpeg({ quality: 98 })
      .toFile(alteredPath);

    // Phase 2: Dynamic Analysis
    exec(`exiftool -json "${alteredPath}"`, (err, stdout) => {
      if (err) {
        console.error("ExifTool Analysis Error:", err);
        return res.status(500).send("Analysis Error.");
      }
      
      const exifData = JSON.parse(stdout)[0];
      res.json({
        tempFile: path.basename(alteredPath),
        originalName: req.file.originalname,
        dynamicMetadata: exifData
      });
      
      // Cleanup original upload
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    });
  } catch (err) {
    console.error("Sharp Processing Error:", err);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    res.status(500).send("Image Processing Error.");
  }
});

/**
 * Phase 3: Processing Execution (Metadata Injection)
 */
app.post("/process", async (req, res) => {
  const { tempFile, metadata, originalName } = req.body;
  const inputPath = path.join(uploadDir, tempFile);
  const outputPath = path.join(outputDir, "processed_" + tempFile);

  if (!fs.existsSync(inputPath)) {
    return res.status(404).send("Temporary file not found.");
  }

  const escape = (s) => {
    if (typeof s !== 'string') s = String(s);
    return s.replace(/"/g, '\\"');
  };

  // Build ExifTool command
  // 1. Destructive sweep (-all=)
  // 2. Inject new payload
  let exifArgs = ["-all=", "-XMP:all=", "-IPTC:all=", "-Photoshop:all=", "--trailer:all", "-MakerNotes:all=", "-PreviewImage=", "-ThumbnailImage="];

  for (let [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null && value !== "") {
      // Handle GPS specifically if needed, but here we assume keys are formatted for ExifTool
      exifArgs.push(`-${key}="${escape(value)}"`);
    }
  }

  const cmd = `exiftool ${exifArgs.join(" ")} -o "${outputPath}" "${inputPath}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error("ExifTool Injection Error:", err);
      return res.status(500).send("Metadata Injection Error.");
    }

    res.json({
      downloadUrl: `/download/${path.basename(outputPath)}`,
      fileName: `Archive_${originalName || 'image.jpg'}`
    });

    // Cleanup altered temp file
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  });
});

app.get("/download/:filename", (req, res) => {
  const filePath = path.join(outputDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (!err) {
        // Cleanup after download
        fs.unlinkSync(filePath);
      }
    });
  } else {
    res.status(404).send("File not found.");
  }
});

app.listen(port, () => console.log(`Storyline Archiver Engine active on port ${port}`));
