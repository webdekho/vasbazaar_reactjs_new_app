#!/bin/bash

# Xcode Cloud post-clone script for Capacitor 8 (SPM)

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

# Build the React app
echo "======================================"
echo "Building React app..."
echo "======================================"
npm run build

# Sync Capacitor (copies web assets to iOS)
echo "======================================"
echo "Syncing Capacitor iOS..."
echo "======================================"
npx cap sync ios

echo "======================================"
echo "CI Post-Clone Script Complete!"
echo "======================================"
echo "Note: SPM dependencies will be resolved by Xcode automatically"
echo "======================================"
