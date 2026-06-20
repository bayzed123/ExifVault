
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

  // ExifTool command to strip metadata and inject custom profile
  const exiftoolCommand = `exiftool -all= \
    -EXIF:Make=\"${customMetadata.make}\" \
    -EXIF:Model=\"${customMetadata.model}\" \
    -EXIF:Software=\"${customMetadata.software}\" \
    -EXIF:Artist=\"${customMetadata.artist}\" \
    -EXIF:Copyright=\"${customMetadata.copyright}\" \
    -IPTC:By-line=\"${customMetadata.byline}\" \
    -IPTC:CopyrightNotice=\"${customMetadata.copyrightNotice}\" \
    -IPTC:ObjectName=\"${customMetadata.objectName}\" \
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
