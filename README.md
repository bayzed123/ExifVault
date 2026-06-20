# Bayezid Storyline Archival Tool

A lightweight, automated web application to strip metadata from images and inject a custom archival profile.

## Features

- **Metadata Stripping**: Automatically removes all hidden AI strings, Adobe XMP tags, and C2PA credentials.
- **Custom Profile Injection**: Injects a predefined or customized EXIF/IPTC profile (Epson Perfection V850 Pro, VueScan 9, etc.).
- **Automated Workflow**: Upload an image and get the processed version instantly downloaded.
- **Local Profile Management**: Customize and save your metadata profile directly in your browser's local storage.
- **Privacy Focused**: Files are instantly deleted from the server after the download starts.

## Tech Stack

- **Backend**: Node.js, Express, Multer
- **Engine**: ExifTool (via child_process)
- **Frontend**: HTML5, CSS3, JavaScript (Fetch API)

## Installation

1.  **Install ExifTool**:
    ```bash
    sudo apt-get update && sudo apt-get install -y exiftool
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Run the Application**:
    ```bash
    npm start
    ```

4.  **Access the Tool**:
    Open your browser and navigate to `http://localhost:3000`.

## Usage

1.  (Optional) Edit the "Custom Metadata Profile" section at the bottom and click "Save Profile".
2.  Drag and drop an image (JPEG, PNG, or WebP) into the drop area, or click to select a file.
3.  The tool will automatically process the image and trigger a download of the "Archive_[Original_Filename]" version.

## Repository Details

This project is part of the [Bayezid Storyline Historical Archive](https://github.com/bayzed123/ExifVault).
