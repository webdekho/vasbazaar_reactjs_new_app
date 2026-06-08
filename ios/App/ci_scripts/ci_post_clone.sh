#!/bin/bash

# Xcode Cloud post-clone script

set -e

echo "======================================"
echo "Starting CI Post-Clone Script"
echo "======================================"

cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "Current directory: $(pwd)"

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
