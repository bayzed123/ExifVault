# Bayezid Storyline Archival Tool: Signature Edition

## Preserve Your Legacy. Define Your Narrative.

Welcome to the **Bayezid Storyline Archival Tool: Signature Edition** – a sophisticated web application meticulously crafted to empower historians, archivists, and creators in preserving the authenticity and integrity of their visual assets. In an era where digital provenance is paramount, this tool offers an unparalleled solution to cleanse images of unwanted digital footprints and imbue them with a rich, custom-defined historical narrative.

--- 

### The Challenge of Digital Authenticity

Modern imaging techniques, including AI generation and advanced editing software, often embed hidden metadata, AI strings, Adobe XMP tags, and C2PA credentials that can compromise the perceived authenticity of an image. For historical archives, educational purposes, or personal collections, maintaining a clear, verifiable chain of custody and ownership is crucial. The Signature Edition addresses this by providing a robust mechanism to control and define your image's digital identity.

--- 

## Key Features of the Signature Edition

*   **Deep Metadata Cleansing**: Go beyond superficial removal. Our enhanced backend meticulously strips all existing metadata, including elusive AI strings, Adobe XMP tags, and C2PA credentials, ensuring a pristine canvas for your archival work.

*   **Intelligent Metadata Injection**: Define your image's story with precision. Inject a comprehensive custom profile, including:
    *   **Authentic Technical Signatures**: Randomized `EXIF:Make`, `EXIF:Model`, `EXIF:Software`, `EXIF:DateTimeOriginal`, `EXIF:CreateDate`, `EXIF:ModifyDate`, and a unique `EXIF:SerialNumber` to simulate genuine scanner output, preventing algorithmic detection of repetitive patterns.
    *   **Rich Archival Narratives**: Embed detailed `IPTC:Caption-Abstract` (Description) and `IPTC:Keywords` to provide context, historical significance, and discoverability for your images.
    *   **Unwavering Ownership**: Clearly assert your rights with `EXIF:Artist`, `EXIF:Copyright`, `IPTC:By-line`, `IPTC:CopyrightNotice`, and `IPTC:ObjectName`.

*   **Live Metadata Preview**: Witness your narrative unfold in real-time. The intuitive frontend now features a live preview panel, allowing you to see the exact metadata that will be injected into your image *before* processing. This ensures complete control and confidence in your archival output.

*   **Seamless Automated Workflow**: Experience unparalleled efficiency. Simply drag-and-drop or select your image, and the tool automatically processes it and triggers an instant download of your newly archived file, named `Archive_[Original_Filename]`.

*   **Persistent Profile Management**: Your custom metadata profile is saved directly in your browser's local storage, ready for your next session. No need to re-enter details for every image.

*   **Privacy-Centric Design**: Your data remains yours. All uploaded files are instantly deleted from the server immediately after processing and download, ensuring maximum privacy and minimal server footprint.

--- 

## How to Use

### Online (via GitHub Pages - Frontend Only)

For a quick, client-side experience, you can access the frontend interface directly via GitHub Pages. Please note that for the full functionality (image processing and metadata injection), you will need to run the backend locally.

[**Access the Frontend Live Demo**](https://bayzed123.github.io/ExifVault/)

### Local Deployment (Full Functionality)

To leverage the complete power of the Bayezid Storyline Archival Tool, including its robust backend processing, follow these steps:

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/bayzed123/ExifVault.git
    cd ExifVault
    ```

2.  **Install ExifTool (if not already installed)**:
    The backend relies on `exiftool`. Install it via your system's package manager:
    ```bash
    sudo apt-get update && sudo apt-get install -y exiftool # For Debian/Ubuntu
    # brew install exiftool # For macOS
    # choco install exiftool # For Windows (using Chocolatey)
    ```

3.  **Install Node.js Dependencies**:
    ```bash
    npm install
    ```

4.  **Run the Application**:
    ```bash
    npm start
    ```

5.  **Access the Tool**:
    Open your web browser and navigate to `http://localhost:3000`.

### Usage Steps:

1.  **Customize Your Profile**: In the "Custom Metadata Profile" section, enter your desired details for Make, Model, Software, Artist, Copyright, By-line, Copyright Notice, Object Name, Description, and Keywords.
2.  **Live Preview**: Observe the "Live Metadata Preview" panel to see how your injected metadata will appear.
3.  **Save Your Settings**: Click the "Save Profile" button to store your current profile in local browser storage for future use.
4.  **Upload & Archive**: Drag and drop an image (JPEG, PNG, or WebP) into the designated area, or click to select a file. The tool will automatically process the image and initiate an instant download of the `Archive_[Original_Filename]` version.

--- 

## Technical Stack

*   **Frontend**: HTML5, CSS3, JavaScript (Fetch API, Local Storage)
*   **Backend**: Node.js, Express.js, Multer (for file uploads)
*   **Core Engine**: ExifTool (via `child_process` for robust metadata manipulation)

--- 

## Contribution & Support

This tool is a personal project by Bayezid Storyline, enhanced by Manus AI. For any inquiries or suggestions, please refer to the project owner.

--- 

*Developed with precision and creativity by Manus AI for Bayezid Storyline.*
