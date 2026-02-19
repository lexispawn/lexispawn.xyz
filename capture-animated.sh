#!/bin/bash
# Capture animated gif from 14minds read page
# Usage: ./capture-animated.sh /path/to/reads/token.html /path/to/output.gif

HTML_PATH=$1
OUTPUT_PATH=$2

if [ -z "$HTML_PATH" ] || [ -z "$OUTPUT_PATH" ]; then
  echo "Usage: ./capture-animated.sh <html-path> <output-path>"
  exit 1
fi

echo "Capturing frames from $HTML_PATH..."

# Capture 30 frames using puppeteer
node /tmp/capture-frames.js "$HTML_PATH"

echo "Uploading frames to VPS..."
scp /tmp/frame-*.png lexispawn-vps:/tmp/

echo "Converting to animated gif on VPS (80 frames @ 8fps)..."
ssh lexispawn-vps "ffmpeg -y -framerate 8 -i /tmp/frame-%03d.png -vf 'fps=8,scale=1080:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse' /tmp/output.gif 2>&1" | tail -5

echo "Downloading gif..."
scp lexispawn-vps:/tmp/output.gif "$OUTPUT_PATH"

echo "Cleaning up..."
rm /tmp/frame-*.png
ssh lexispawn-vps "rm /tmp/frame-*.png /tmp/output.gif"

echo "Created: $OUTPUT_PATH"
ls -lh "$OUTPUT_PATH"
