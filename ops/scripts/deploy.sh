#!/usr/bin/env bash
# Deploy to Hetzner VPS via SSH
# Usage: ./deploy.sh [staging|production]
set -euo pipefail

ENV="${1:-staging}"

case "$ENV" in
    staging)
        HOST="${STAGING_HOST:?Set STAGING_HOST}"
        ;;
    production)
        HOST="${PRODUCTION_HOST:?Set PRODUCTION_HOST}"
        ;;
    *)
        echo "Usage: $0 [staging|production]"
        exit 1
        ;;
esac

echo "Deploying to ${ENV} (${HOST})..."

# Build frontend
echo "Building frontend..."
cd frontend/apps/embryologist-console
npm ci
npm run build
cd ../../..

# Sync files to server
echo "Syncing to ${HOST}..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.venv' \
    --exclude='__pycache__' \
    --exclude='.git' \
    ./ "${HOST}:/opt/ivf-lab-platform/"

# Run migrations and restart on server
echo "Running migrations and restarting services..."
ssh "$HOST" << 'REMOTE'
cd /opt/ivf-lab-platform
docker compose -f ops/docker/docker-compose.yml pull
docker compose -f ops/docker/docker-compose.yml run --rm app alembic upgrade head
docker compose -f ops/docker/docker-compose.yml up -d
docker compose -f ops/docker/docker-compose.yml ps
REMOTE

echo "Deploy to ${ENV} complete."
