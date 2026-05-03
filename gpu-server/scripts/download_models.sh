#!/usr/bin/env bash
set -euo pipefail

# Download YOLO weights to the standard location.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
WEIGHTS_DIR="${PROJECT_ROOT}/weights"

mkdir -p "${WEIGHTS_DIR}"

MODEL_FILE="${WEIGHTS_DIR}/yolo11n.pt"
MODEL_URL="https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.pt"

if [[ -f "${MODEL_FILE}" ]]; then
    echo "✓ Model already exists: ${MODEL_FILE}"
    ls -lh "${MODEL_FILE}"
    exit 0
fi

echo "Downloading YOLO11n weights..."
curl -L --fail --show-error -o "${MODEL_FILE}" "${MODEL_URL}"

echo "✓ Downloaded to ${MODEL_FILE}"
ls -lh "${MODEL_FILE}"
