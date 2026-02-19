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

echo "Converting to MP4 video on VPS (72 frames @ 8fps)..."
ssh lexispawn-vps "ffmpeg -y -framerate 8 -i /tmp/frame-%03d.png -vf 'fps=8,scale=1080:1080:flags=lanczos' -c:v libx264 -pix_fmt yuv420p -preset slow -crf 18 -movflags +faststart /tmp/output.mp4 2>&1" | tail -5

echo "Downloading MP4..."
scp lexispawn-vps:/tmp/output.mp4 "$OUTPUT_PATH"

echo "Cleaning up..."
rm /tmp/frame-*.png
ssh lexispawn-vps "rm /tmp/frame-*.png /tmp/output.gif"

echo "Created: $OUTPUT_PATH"
ls -lh "$OUTPUT_PATH"
