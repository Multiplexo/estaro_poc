# Betrieb mit `compose.production.yaml`

Diese Anleitung gilt für jeden Server mit Docker Compose (z. B. Sliplane, Hetzner oder
eine Umgebung bei estaro).

## Voraussetzungen

- Docker mit Compose-Plugin
- Empfohlen **8 GB RAM** für den gesamten Stack: der Worker allein ist auf 4 GB
  begrenzt (siehe [PDF-Konvertierung](pdf-konvertierung.md)), dazu API, Postgres,
  Redis, MinIO und Frontend
- `.env` nach Vorlage `.env.exmaple`, zusätzlich `PUBLIC_URL` (öffentliche Adresse
  ohne Schrägstrich am Ende)

## Start und Aktualisierung

```sh
docker compose -f compose.production.yaml up -d --build
```

Datenbank-Migrationen laufen automatisch im Dienst `migrate`, bevor API und Worker
starten. Regeln werden einmalig importiert; Stammdaten gleicht der Worker nachts
automatisch ab, sobald `MASTERDATA_SOURCE` gesetzt ist (siehe
[Stammdaten](stammdaten.md)). Manuell:

```sh
docker compose -f compose.production.yaml run --rm -v "$PWD/resources:/resources:ro" \
  backend /app/.venv/bin/python -m scripts.import_data --resources /resources
docker compose -f compose.production.yaml run --rm backend \
  /app/.venv/bin/python -m scripts.import_rules
docker compose -f compose.production.yaml run --rm -v "$PWD/Bezeichnungen.xlsx:/terms.xlsx:ro" \
  backend /app/.venv/bin/python -m scripts.import_terms --file /terms.xlsx
```

## Konfiguration für den Betrieb

| Variable | Standard | Zweck |
|---|---|---|
| `LOG_FORMAT` | `json` (Compose) / `console` (lokal) | JSON-Zeilen für Log-Plattformen |
| `WORKER_MEMORY_LIMIT` | `4g` | Speicherlimit des Extraktions-Workers |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Abstand zwischen zwei Sicherungen |
| `BACKUP_RETENTION_DAYS` | `14` | Aufbewahrung der Sicherungen auf dem Server |
| `FEEDBACK_WEBHOOK_URL` | leer | Feedback zusätzlich als JSON an ein Ticketsystem senden (Feld `text` für Slack/Teams, `feedback` mit allen Angaben) |

## Datensicherung

Der Dienst `backup` erstellt im eingestellten Abstand

- `postgres-<Zeitstempel>.dump`: Datenbank-Dump (`pg_dump --format=custom`)
- `minio-<Zeitstempel>.tar.gz`: Archiv aller hochgeladenen Dokumente

im Docker-Volume `backups` und löscht Sicherungen, die älter als
`BACKUP_RETENTION_DAYS` sind. Jeder Lauf schreibt eine JSON-Logzeile
(`backup_completed`, bei Fehlern `backup_postgres_failed` bzw. `backup_minio_failed`).

**Wichtig:** Das Volume liegt auf demselben Server. Für den Pilotbetrieb müssen die
Dateien zusätzlich außerhalb des Servers gesichert werden (z. B. Storage Box,
S3-kompatibler Speicher in Deutschland). Wie, hängt vom Hoster ab.

Sicherungen ansehen:

```sh
docker compose -f compose.production.yaml run --rm --entrypoint ls backup -la /backups
```

## Wiederherstellung

1. API, Worker und Scheduler stoppen:

   ```sh
   docker compose -f compose.production.yaml stop backend extraction_worker deletion_scheduler
   ```

2. Datenbank wiederherstellen (ersetzt den aktuellen Inhalt):

   ```sh
   docker compose -f compose.production.yaml run --rm --entrypoint sh backup -c \
     'pg_restore --clean --if-exists --no-owner -d "$PGDATABASE" /backups/postgres-<Zeitstempel>.dump'
   ```

3. Dokumente wiederherstellen (MinIO stoppen, Archiv ins Volume entpacken):

   ```sh
   docker compose -f compose.production.yaml stop minio
   docker run --rm -v estaro-production_minio_data:/minio -v estaro-production_backups:/backups:ro \
     alpine sh -c 'rm -rf /minio/* && tar -xzf /backups/minio-<Zeitstempel>.tar.gz -C /minio'
   docker compose -f compose.production.yaml up -d
   ```

Getestet am 23.11.2026: Dump und Archiv erstellt, Dump mit `pg_restore` in eine leere
Datenbank zurückgespielt, Archiv entpackt.

## Logs

```sh
docker compose -f compose.production.yaml logs -f extraction_worker
```

Fehlgeschlagene Jobs stehen zusätzlich mit lesbarer Ursache am Job (z. B.
„KI-Anbieter: Limit oder Kontingent erreicht (HTTP 429)“) und sind in der Oberfläche
über das Fehlersymbol der Anfrage sichtbar.

Hinweise für Alarme: `extraction_job_failed`, `matching_job_failed`,
`backup_postgres_failed`, `backup_minio_failed` sowie Neustarts des Workers (`docker compose ps`).
