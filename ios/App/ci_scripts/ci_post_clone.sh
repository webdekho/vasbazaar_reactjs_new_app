#!/bin/bash

# Xcode Cloud post-clone script
# This script runs after the repository is cloned

set -e  # Exit on any error

echo "======================================"
echo "Starting CI Post-Clone Script"
echo "======================================"

cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "Current directory: $(pwd)"

# Install Node.js dependencies (required for Capacitor pods)
echo "======================================"
echo "Installing Node.js dependencies..."
echo "======================================"
npm install

# Navigate to iOS App directory
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"

echo "Current directory: $(pwd)"
echo "Podfile exists: $(test -f Podfile && echo 'YES' || echo 'NO')"

# Install CocoaPods dependencies
echo "======================================"
echo "Installing CocoaPods dependencies..."
echo "======================================"
pod install --repo-update

echo "======================================"
echo "CI Post-Clone Script Complete!"
echo "======================================"
