#!/bin/sh
# Periodic backup: PostgreSQL dump (custom format) and an archive of the MinIO data
# directory. Runs in the "backup" service of compose.production.yaml.
# Connection settings come from PGHOST, PGDATABASE, PGUSER and PGPASSWORD.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
MINIO_DIR="${MINIO_DIR:-/minio}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

log() {
    printf '{"event": "%s", "level": "%s", "logger": "backup", "timestamp": "%s"%s}\n' \
        "$1" "$2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${3:-}"
}

run_backup() {
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    dump="$BACKUP_DIR/postgres-$stamp.dump"
    archive="$BACKUP_DIR/minio-$stamp.tar.gz"

    if ! pg_dump --format=custom --file="$dump.partial"; then
        rm -f "$dump.partial"
        log backup_postgres_failed error
        return 1
    fi
    mv "$dump.partial" "$dump"

    if [ -d "$MINIO_DIR" ]; then
        if ! tar -czf "$archive.partial" -C "$MINIO_DIR" .; then
            rm -f "$archive.partial"
            log backup_minio_failed error
            return 1
        fi
        mv "$archive.partial" "$archive"
    fi

    find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'postgres-*.dump' -o -name 'minio-*.tar.gz' \) \
        -mtime +"$RETENTION_DAYS" -delete
    log backup_completed info ", \"dump\": \"$(basename "$dump")\", \"size_bytes\": $(wc -c < "$dump")"
}

mkdir -p "$BACKUP_DIR"
while true; do
    run_backup || true
    sleep "$INTERVAL"
done
