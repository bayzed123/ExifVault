#!/bin/bash

# Render Build Script for ExifVault
# This script ensures all dependencies are installed, including ExifTool

echo "Starting ExifVault build process..."

# Update package manager
echo "Updating package manager..."
apt-get update -y

# Install ExifTool (required for metadata processing)
echo "Installing ExifTool..."
apt-get install -y libimage-exiftool-perl

# Verify ExifTool installation
echo "Verifying ExifTool installation..."
exiftool -ver

# Install Node dependencies
echo "Installing Node dependencies..."
npm install

echo "Build process completed successfully!"
