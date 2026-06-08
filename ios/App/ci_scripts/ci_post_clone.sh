#!/bin/bash

# Xcode Cloud post-clone script
# This script runs after the repository is cloned

echo "Installing CocoaPods dependencies..."

# Navigate to the App directory where Podfile is located
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"

# Install CocoaPods dependencies
pod install

echo "CocoaPods installation complete!"
