#!/usr/bin/env bash
# Startup script for the GPU pod.
set -euo pipefail

exec uvicorn src.api:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 1 \
  --log-level info
