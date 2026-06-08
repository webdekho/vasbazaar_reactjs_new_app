#!/bin/bash

# Xcode Cloud post-clone script
# This script runs after the repository is cloned

echo "======================================"
echo "Installing CocoaPods dependencies..."
echo "======================================"

# Navigate to the App directory where Podfile is located
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"

echo "Current directory: $(pwd)"
echo "Podfile exists: $(test -f Podfile && echo 'YES' || echo 'NO')"

# Install CocoaPods dependencies
pod install --repo-update

echo "======================================"
echo "CocoaPods installation complete!"
echo "======================================"

# List Pods directory to verify
ls -la Pods/
