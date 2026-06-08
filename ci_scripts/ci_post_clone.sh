#!/bin/bash

# Xcode Cloud post-clone script

set -e

echo "======================================"
echo "Starting CI Post-Clone Script"
echo "======================================"

# Install Node.js using Homebrew
echo "======================================"
echo "Installing Node.js..."
echo "======================================"
brew install node

cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Install Node.js dependencies
echo "======================================"
echo "Installing Node.js dependencies..."
echo "======================================"
npm ci --legacy-peer-deps

# Navigate to iOS App directory
echo "======================================"
echo "Installing CocoaPods dependencies..."
echo "======================================"
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"

pod install --repo-update

echo "======================================"
echo "CI Post-Clone Script Complete!"
echo "======================================"
