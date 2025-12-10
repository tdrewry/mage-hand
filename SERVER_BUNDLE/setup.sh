#!/bin/bash

# Tabletop Multiplayer Server Setup Script
# This script creates the actual server files from the .txt templates

set -e

echo "=========================================="
echo "Tabletop Multiplayer Server Setup"
echo "=========================================="

# Create output directory
OUTPUT_DIR="tabletop-server"

if [ -d "$OUTPUT_DIR" ]; then
    echo "Warning: '$OUTPUT_DIR' directory already exists."
    read -p "Do you want to overwrite it? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Setup cancelled."
        exit 0
    fi
    rm -rf "$OUTPUT_DIR"
fi

mkdir -p "$OUTPUT_DIR"
echo "Created directory: $OUTPUT_DIR"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy and rename files
echo "Copying server files..."

cp "$SCRIPT_DIR/package.json.txt" "$OUTPUT_DIR/package.json"
echo "  ✓ package.json"

cp "$SCRIPT_DIR/index.js.txt" "$OUTPUT_DIR/index.js"
echo "  ✓ index.js"

cp "$SCRIPT_DIR/sessionManager.js.txt" "$OUTPUT_DIR/sessionManager.js"
echo "  ✓ sessionManager.js"

cp "$SCRIPT_DIR/eventHandlers.js.txt" "$OUTPUT_DIR/eventHandlers.js"
echo "  ✓ eventHandlers.js"

cp "$SCRIPT_DIR/env.example.txt" "$OUTPUT_DIR/.env.example"
echo "  ✓ .env.example"

cp "$SCRIPT_DIR/gitignore.txt" "$OUTPUT_DIR/.gitignore"
echo "  ✓ .gitignore"

cp "$SCRIPT_DIR/README.md.txt" "$OUTPUT_DIR/README.md"
echo "  ✓ README.md"

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. cd $OUTPUT_DIR"
echo "  2. npm install"
echo "  3. npm start"
echo ""
echo "The server will run on http://localhost:3001"
echo ""
