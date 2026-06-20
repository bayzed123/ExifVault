
const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

// Set up Multer for file uploads
const upload = multer({
  dest: "uploads/", // temporary directory for uploaded files
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and WebP images are allowed!"), false);
    }
    cb(null, true);
  },
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Helper function to generate random dates within a range
function getRandomDate(startYear, endYear) {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  const date = new Date(start + Math.random() * (end - start));
  
  // Format for EXIF: YYYY:MM:DD HH:MM:SS
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Helper function to generate random scanner serial numbers
function getRandomSerialNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const originalFilePath = req.file.path;
  const originalFileName = req.file.originalname;
  const processedFileName = `Archive_${originalFileName}`;
  const processedFilePath = path.join(path.dirname(originalFilePath), processedFileName);

  let customMetadata = {};
  try {
    customMetadata = JSON.parse(req.body.customMetadata);
  } catch (e) {
    console.error("Error parsing custom metadata:", e);
    fs.unlinkSync(originalFilePath);
    return res.status(400).send("Invalid custom metadata provided.");
  }

  // Randomization logic
  const scanDate = getRandomDate(2015, 2023); // Random scan date between 2015 and 2023
  const serialNumber = getRandomSerialNumber();
  
  // Escape quotes in user input to prevent command injection
  const escapeShellArg = (arg) => {
    if (!arg) return '';
    return arg.replace(/"/g, '\\"');
  };

  // Advanced ExifTool command
  // 1. -all= removes everything
  // 2. -XMP:all= -IPTC:all= -Photoshop:all= ensures deep cleansing of AI tags
  // 3. Injects custom profile + randomized technical data + historical tags
  const exiftoolCommand = `exiftool -all= -XMP:all= -IPTC:all= -Photoshop:all= \
    -EXIF:Make="${escapeShellArg(customMetadata.make)}" \
    -EXIF:Model="${escapeShellArg(customMetadata.model)}" \
    -EXIF:Software="${escapeShellArg(customMetadata.software)}" \
    -EXIF:Artist="${escapeShellArg(customMetadata.artist)}" \
    -EXIF:Copyright="${escapeShellArg(customMetadata.copyright)}" \
    -EXIF:DateTimeOriginal="${scanDate}" \
    -EXIF:CreateDate="${scanDate}" \
    -EXIF:ModifyDate="${scanDate}" \
    -EXIF:SerialNumber="${serialNumber}" \
    -IPTC:By-line="${escapeShellArg(customMetadata.byline)}" \
    -IPTC:CopyrightNotice="${escapeShellArg(customMetadata.copyrightNotice)}" \
    -IPTC:ObjectName="${escapeShellArg(customMetadata.objectName)}" \
    -IPTC:Caption-Abstract="${escapeShellArg(customMetadata.description)}" \
    -IPTC:Keywords="${escapeShellArg(customMetadata.keywords)}" \
    -overwrite_original "${originalFilePath}"`;

  exec(exiftoolCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`ExifTool error: ${error.message}`);
      fs.unlinkSync(originalFilePath); // Delete original file on error
      return res.status(500).send("Error processing image.");
    }
    if (stderr) {
      console.error(`ExifTool stderr: ${stderr}`);
    }

    // Rename the processed file to match the desired output name
    fs.rename(originalFilePath, processedFilePath, (err) => {
      if (err) {
        console.error(`File rename error: ${err.message}`);
        fs.unlinkSync(originalFilePath); // Delete original file on error
        return res.status(500).send("Error renaming processed image.");
      }

      // Force download stream
      res.download(processedFilePath, processedFileName, (downloadErr) => {
        if (downloadErr) {
          console.error(`Download error: ${downloadErr.message}`);
        }
        // Delete the file from the server after download is initiated
        fs.unlink(processedFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error(`Error deleting processed file: ${unlinkErr.message}`);
          }
        });
      });
    });
  });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
