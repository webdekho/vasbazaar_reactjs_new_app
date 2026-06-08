#!/bin/bash

# Xcode Cloud post-clone script

set -e

echo "======================================"
echo "Installing CocoaPods dependencies..."
echo "======================================"

cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"

pod install --repo-update

echo "======================================"
echo "CocoaPods installation complete!"
echo "======================================"
