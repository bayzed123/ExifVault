const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();


const app = express();
const port = process.env.PORT || 3000;

// Directories
const uploadDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "outputs");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

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
  fileFilter: (req, file, cb) => {
    // Accept all image types
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

app.use(express.static(__dirname));
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(400).send('File size exceeds 50MB limit.');
    }
  }
  if (err.message === 'Only image files are allowed') {
    return res.status(400).send('Only image files are allowed.');
  }
  res.status(500).send('Server error: ' + err.message);
});

/**
 * Check if exiftool is available
 */
function checkExiftoolAvailable() {
  return new Promise((resolve) => {
    exec('exiftool -ver', (err, stdout) => {
      if (err) {
        console.warn('ExifTool not found. Image processing will be limited.');
        resolve(false);
      } else {
        console.log('ExifTool version:', stdout.trim());
        resolve(true);
      }
    });
  });
}

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
    
    // Validate image dimensions
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image file');
    }

    // Extract and re-encode to disrupt pixel lattice
    await image
      .extract({ 
        left: 0, 
        top: 0, 
        width: Math.max(1, metadata.width - 1), 
        height: Math.max(1, metadata.height - 1) 
      })
      .jpeg({ quality: 98 })
      .toFile(alteredPath);

    // Try to extract metadata with exiftool
    exec(`exiftool -json "${alteredPath}"`, (err, stdout) => {
      let exifData = {};
      
      if (!err && stdout) {
        try {
          const parsed = JSON.parse(stdout);
          exifData = parsed[0] || {};
        } catch (parseErr) {
          console.warn("Could not parse exiftool output:", parseErr);
        }
      } else if (err) {
        console.warn("ExifTool extraction warning:", err.message);
      }

      // Always return success with whatever metadata we could extract
      res.json({
        tempFile: alteredFilename,
        originalName: req.file.originalname,
        dynamicMetadata: exifData,
        imageMetadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          channels: metadata.channels,
          depth: metadata.depth,
          density: metadata.density,
          hasAlpha: metadata.hasAlpha,
          orientation: metadata.orientation
        }
      });

      // Clean up original uploaded file
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
    });
  } catch (err) {
    console.error("Sharp Processing Error:", err);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(alteredPath)) fs.unlinkSync(alteredPath);
    res.status(500).send("Image Processing Error: " + err.message);
  }
});

/**
 * Phase 3: Processing Execution (Metadata Injection)
 */
app.post("/process", async (req, res) => {
  const { tempFile, metadata, originalName } = req.body;
  
  if (!tempFile || !metadata) {
    return res.status(400).send("Missing required parameters.");
  }

  const inputPath = path.join(uploadDir, tempFile);
  const outputFilename = "processed_" + Date.now() + "_" + tempFile;
  const outputPath = path.join(outputDir, outputFilename);

  if (!fs.existsSync(inputPath)) {
    return res.status(404).send("Temporary file not found.");
  }

  try {
    // Use an argument file for exiftool to prevent command injection and handle long arguments
    const argFile = path.join(uploadDir, `args_${Date.now()}_${tempFile}.txt`);
    let argContent = [
  "-all=",
  "-XMP:all=",
  "-IPTC:all=",
  "-Photoshop:all=",
  "--trailer:all=",
  "-MakerNotes:all=",
  "-PreviewImage=",
  "-ThumbnailImage=",
  "-make=Apple",
  "-model=iPhone 16 Pro",
  "-artist=Sayad Md Bayezid Hosan",
  "-copyright=2026 Bayezid Storyline",
  "-ImageDescription=Historical Archive Restoration",
  "-Software=ExifVault Pro v1.0",
  "-overwrite_original",
  "-preserve"
];

    for (let [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null && value !== "") {
        // Clean the key - remove prefixes and ensure valid format
        let cleanKey = key;
        if (key.includes(':')) {
          const parts = key.split(':');
          cleanKey = parts[parts.length - 1];
        }
        
        // Escape quotes in values
        const escapedValue = String(value).replace(/"/g, '\\"');
        argContent.push(`-${cleanKey}=${escapedValue}`);
      }
    }
    
    argContent.push("-o");
    argContent.push(outputPath);
    argContent.push(inputPath);

    fs.writeFileSync(argFile, argContent.join("\n"));

    exec(`exiftool -@ "${argFile}"`, (err) => {
      // Clean up arg file
      if (fs.existsSync(argFile)) {
        fs.unlinkSync(argFile);
      }

      if (err) {
        console.error("ExifTool Injection Error:", err);
        // Don't fail - exiftool might not be available on the server
        // Just copy the file as-is
        try {
          fs.copyFileSync(inputPath, outputPath);
        } catch (copyErr) {
          console.error("File copy error:", copyErr);
          return res.status(500).send("Metadata Injection Error: " + err.message);
        }
      }

      // Save record to DB
      db.run(`INSERT INTO records (filename, temp_path, output_path) VALUES (?, ?, ?)`, 
        [originalName, inputPath, outputPath], function(err) {
          if (err) console.error("DB Error:", err);
      });

      // Generate safe filename for download
      const ext = path.extname(originalName) || '.jpg';
      const baseName = path.basename(originalName, ext);
      const safeFileName = `Archive_${baseName}${ext}`.replace(/[^\w\s.-]/gi, '_');

      res.json({
        downloadUrl: `/download/${outputFilename}`,
        fileName: safeFileName
      });
    });
  } catch (err) {
    console.error("Process Error:", err);
    res.status(500).send("Processing Error: " + err.message);
  }
});

app.get("/download/:filename", (req, res) => {
  const filePath = path.join(outputDir, req.params.filename);
  
  // Security check - prevent directory traversal
  if (!filePath.startsWith(outputDir)) {
    return res.status(403).send("Access denied.");
  }

  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (err) {
        console.error("Download error:", err);
      }
    });
  } else {
    res.status(404).send("File not found or already deleted.");
  }
});

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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

    if (rows && rows.length > 0) {
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
    }
  });

  // Also clean up any stray files in uploads/outputs not in DB older than 1 hour
  const cleanupStray = (dir) => {
    try {
      fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > 60 * 60 * 1000) {
            fs.unlinkSync(filePath);
            console.log(`[Cleanup] Deleted stray file: ${file}`);
          }
        } catch (statErr) {
          console.warn(`Could not stat file ${file}:`, statErr.message);
        }
      });
    } catch (readErr) {
      console.warn(`Could not read directory ${dir}:`, readErr.message);
    }
  };

  cleanupStray(uploadDir);
  cleanupStray(outputDir);

}, 5 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing database...');
  db.close((err) => {
    if (err) console.error('Database close error:', err);
    process.exit(0);
  });
});

app.listen(port, () => {
  console.log(`Storyline Archiver Engine active on port ${port}`);
  checkExiftoolAvailable();
});
