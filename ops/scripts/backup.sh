#!/usr/bin/env bash
# Backup PostgreSQL database to Hetzner Object Storage (S3-compatible)
# Run via cron or Docker scheduled container
set -euo pipefail

DB_HOST="${DB_HOST:-db}"
DB_NAME="${DB_NAME:-ivf_lab}"
DB_USER="${DB_USER:-ivf_app}"
BACKUP_DIR="/tmp/backups"
DATE=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"

# S3 destination (Hetzner Object Storage)
S3_BUCKET="${S3_BUCKET:-ivf-lab-backups}"
S3_ENDPOINT="${S3_ENDPOINT:-https://fsn1.your-objectstorage.com}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup of ${DB_NAME}..."

# Dump and compress
pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$BACKUP_FILE"

FILESIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup created: ${BACKUP_FILE} (${FILESIZE})"

# Upload to S3 (if configured)
if [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/$(basename "$BACKUP_FILE")" \
        --endpoint-url "$S3_ENDPOINT"
    echo "[$(date)] Uploaded to s3://${S3_BUCKET}/$(basename "$BACKUP_FILE")"
else
    echo "[$(date)] S3 not configured — backup kept locally at ${BACKUP_FILE}"
fi

# Cleanup local backups older than 7 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
echo "[$(date)] Backup complete."
