#!/bin/bash
# Build script for Railway deployment
# Builds frontend + backend, serves both from NestJS on one port

set -e

echo "=== Building Frontend ==="
npm run build
# Move frontend build to backend/frontend-dist
rm -rf backend/frontend-dist
mv dist backend/frontend-dist

echo "=== Building Backend ==="
cd backend
npm install
npm run build

echo "=== Build Complete ==="
echo "Run: cd backend && npm run start:prod"
