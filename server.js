const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();


const app = express();
const port = 3000;

// Directories
const uploadDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "outputs");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// Database Setup
const db = new sqlite3.Database(path.join(__dirname, "archiver.db"));
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    temp_path TEXT,
    output_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

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
  const alteredFilename = req.file.filename + "_altered.jpg";
  const alteredPath = path.join(uploadDir, alteredFilename);

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    await image
      .extract({ left: 0, top: 0, width: metadata.width - 1, height: metadata.height - 1 })
      .jpeg({ quality: 98 })
      .toFile(alteredPath);

    exec(`exiftool -json "${alteredPath}"`, (err, stdout) => {
      if (err) {
        console.error("ExifTool Analysis Error:", err);
        return res.status(500).send("Analysis Error.");
      }
      
      try {
        const exifData = JSON.parse(stdout)[0];
        res.json({
          tempFile: alteredFilename,
          originalName: req.file.originalname,
          dynamicMetadata: exifData
        });
      } catch (parseErr) {
        console.error("JSON Parse Error:", parseErr);
        res.status(500).send("Metadata Analysis Error.");
      } finally {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      }
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
  const outputFilename = "processed_" + tempFile;
  const outputPath = path.join(outputDir, outputFilename);

  if (!fs.existsSync(inputPath)) {
    return res.status(404).send("Temporary file not found.");
  }

  // Use an argument file for exiftool to prevent command injection and handle long arguments
  const argFile = path.join(uploadDir, `args_${tempFile}.txt`);
  let argContent = [
    "-all=",
    "-XMP:all=",
    "-IPTC:all=",
    "-Photoshop:all=",
    "--trailer:all",
    "-MakerNotes:all=",
    "-PreviewImage=",
    "-ThumbnailImage="
  ];

  for (let [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null && value !== "") {
      // Strip 'EXIF:' or 'GPS:' prefix if present as exiftool handles it better in arg files
      const cleanKey = key.includes(':') ? key.split(':')[1] : key;
      argContent.push(`-${cleanKey}=${value}`);
    }
  }
  
  argContent.push("-o");
  argContent.push(outputPath);
  argContent.push(inputPath);

  fs.writeFileSync(argFile, argContent.join("\n"));

  exec(`exiftool -@ "${argFile}"`, (err) => {
    if (fs.existsSync(argFile)) fs.unlinkSync(argFile);
    if (err) {
      console.error("ExifTool Injection Error:", err);
      return res.status(500).send("Metadata Injection Error.");
    }

    // Save record to DB
    db.run(`INSERT INTO records (filename, temp_path, output_path) VALUES (?, ?, ?)`, 
      [originalName, inputPath, outputPath], function(err) {
        if (err) console.error("DB Error:", err);
    });

    res.json({
      downloadUrl: `/download/${outputFilename}`,
      fileName: `Archive_${originalName || 'image.jpg'}`
    });
  });
});

app.get("/download/:filename", (req, res) => {
  const filePath = path.join(outputDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send("File not found or already deleted.");
  }
});

/**
 * AUTO-CLEANUP SYSTEM
 * Runs every 5 minutes, deletes files older than 30 minutes
 */
setInterval(() => {
  const expiryTime = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();

  db.all(`SELECT * FROM records WHERE (julianday('now') - julianday(created_at)) * 24 * 60 > 30`, (err, rows) => {
    if (err) return console.error("Cleanup Query Error:", err);

    rows.forEach(row => {
      try {
        // Delete Files
        if (row.temp_path && fs.existsSync(row.temp_path)) fs.unlinkSync(row.temp_path);
        if (row.output_path && fs.existsSync(row.output_path)) fs.unlinkSync(row.output_path);
        
        // Delete DB Record
        db.run(`DELETE FROM records WHERE id = ?`, [row.id]);
        console.log(`[Cleanup] Deleted expired asset: ${row.filename}`);
      } catch (cleanupErr) {
        console.error(`[Cleanup Error] Failed to delete asset ${row.filename}:`, cleanupErr);
      }
    });
  });

  // Also clean up any stray files in uploads/outputs not in DB older than 1 hour
  const cleanupStray = (dir) => {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
      }
    });
  };
  cleanupStray(uploadDir);
  cleanupStray(outputDir);

}, 5 * 60 * 1000);

app.listen(port, () => console.log(`Storyline Archiver Engine active on port ${port}`));
