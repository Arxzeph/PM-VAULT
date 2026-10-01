#!/bin/bash
set -e

# ==============================================================================
# PM Vault - Automated Build Script for Parrot Security OS / Debian
# ==============================================================================

echo "========================================================"
echo "  🦜 PM Vault - Linux (Parrot OS / Debian) Builder"
echo "========================================================"

# 1. Update Package Lists
echo "\n[1/5] Updating package repositories..."
sudo apt update -y

# 2. Install Required Linux Dependencies for Tauri v2 & WebKit
echo "\n[2/5] Installing core development libraries & WebKitGTK..."
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  squashfs-tools

# Attempt WebKit 4.1, fallback to 4.0 if older Parrot version
if apt-cache show libwebkit2gtk-4.1-dev > /dev/null 2>&1; then
    sudo apt install -y libwebkit2gtk-4.1-dev
else
    sudo apt install -y libwebkit2gtk-4.0-dev
fi

# 3. Check for Rust & Cargo
echo "\n[3/5] Verifying Rust toolchain..."
if ! command -v cargo &> /dev/null; then
    echo "Rust not found. Installing via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "Rust found: $(cargo --version)"
fi

# 4. Check for Node.js & npm
echo "\n[4/5] Verifying Node.js & npm..."
if ! command -v npm &> /dev/null; then
    echo "Node.js not found. Installing Node.js LTS..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"

# 5. Build PM Vault
echo "\n[5/5] Building PM Vault release (.AppImage & .deb)..."
cd desktop

echo "Installing frontend dependencies..."
npm install

echo "Compiling native Linux binary and packages..."
export PATH="$HOME/.cargo/bin:$PATH"
npm run tauri build

cd ..

# 6. Copy output binaries to project root
echo "\nCopying packages to project root..."
mkdir -p dist-linux

# Copy AppImage if generated
find desktop/src-tauri/target/release/bundle/appimage -name "*.AppImage" -exec cp {} ./PM_Vault_Linux.AppImage \; 2>/dev/null || true
find desktop/src-tauri/target/release/bundle/appimage -name "*.AppImage" -exec cp {} ./PM_2.0.0_amd64.AppImage \; 2>/dev/null || true
# Copy Deb if generated
find desktop/src-tauri/target/release/bundle/deb -name "*.deb" -exec cp {} ./PM_Vault_Linux.deb \; 2>/dev/null || true
find desktop/src-tauri/target/release/bundle/deb -name "*.deb" -exec cp {} ./PM_2.0.0_amd64.deb \; 2>/dev/null || true
# Copy raw binary
cp desktop/src-tauri/target/release/desktop ./PM_Vault_Linux_Bin 2>/dev/null || true

echo "\n========================================================"
echo "  ✅ Build Complete!"
echo "========================================================"
if [ -f "PM_Vault_Linux.AppImage" ]; then
    echo "  📦 Portable AppImage: ./PM_Vault_Linux.AppImage"
    echo "  📦 Versioned AppImage: ./PM_2.0.0_amd64.AppImage"
fi
if [ -f "PM_Vault_Linux.deb" ]; then
    echo "  📦 Debian/Parrot Package: ./PM_Vault_Linux.deb"
    echo "  📦 Versioned Deb: ./PM_2.0.0_amd64.deb"
fi
echo "  🚀 Raw Binary: ./PM_Vault_Linux_Bin"
echo "========================================================"
