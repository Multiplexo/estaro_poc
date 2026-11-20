#!/usr/bin/env bash
# Starts every demo process in one container; exits when any of them stops.
set -euo pipefail

cd /app
mkdir -p /tmp/minio

nginx -g "daemon off;" &

redis-server --bind 127.0.0.1 --port 6379 --save "" --appendonly no \
    --maxmemory-policy noeviction &

MINIO_ROOT_USER="$MINIO_ACCESS_KEY" MINIO_ROOT_PASSWORD="$MINIO_SECRET_KEY" \
    minio server /tmp/minio --address 127.0.0.1:9000 --console-address 127.0.0.1:9001 &

.venv/bin/alembic upgrade head

# Master data is uploaded to Render as secret files (gzip + base64 to keep the
# cp1252 bytes intact), never committed to git.
if [[ -f /etc/secrets/Artikelstamm.csv.gz.b64 && -f /etc/secrets/Kundenstamm.csv.gz.b64 ]]; then
    mkdir -p /tmp/stammdaten
    for name in Artikelstamm Kundenstamm; do
        base64 -d "/etc/secrets/$name.csv.gz.b64" | gunzip > "/tmp/stammdaten/$name.csv"
    done
    .venv/bin/python -m scripts.import_data --resources /tmp/stammdaten \
        || echo "master_data_import_failed"
fi
.venv/bin/python -m scripts.import_rules || echo "rule_import_failed"

.venv/bin/celery -A app.workers.celery_app:celery_app worker -B \
    --loglevel=info --queues=extraction --concurrency=1 \
    --schedule=/tmp/celerybeat-schedule &

.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --root-path /api &

wait -n
exit 1
