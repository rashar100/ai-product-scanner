#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "[startup] Installing Python dependencies..."
pip install -q -r "$WORKSPACE/artifacts/product-scanner/requirements.txt"

echo "[startup] Starting Python FastAPI backend on port 8000..."
cd "$WORKSPACE/artifacts/product-scanner"
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
UVICORN_PID=$!

echo "[startup] Waiting for Python backend to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/ > /dev/null 2>&1; then
    echo "[startup] Python backend is ready"
    break
  fi
  sleep 1
done

echo "[startup] Starting Node.js API server..."
cd "$WORKSPACE"
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
