## Getting started

Install Docker with Compose, uv, Python 3.13+, and Bun 1.4.3+. Run the following
commands from the repository root, with Docker running.

1. Copy the environment template (the filename is spelled this way in the repo):

   ```sh
   cp .env.exmaple .env
   ```

   Set `POSTGRES_PASSWORD`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, and
   `API_KEY` in `.env`, and choose a `MODEL` available to your OpenAI account.
   Correct `MS_FETCH_ENABLED=fasle` to `MS_FETCH_ENABLED=false`. Microsoft credentials
   are only needed for Outlook integration.

2. Install backend dependencies, start the infrastructure, and apply migrations:

   ```sh
   uv --directory backend sync
   docker compose up -d
   uv --directory backend run alembic upgrade head
   ```

3. Start the background worker and scheduler, then the API:

   ```sh
   docker compose up -d --build extraction_worker deletion_scheduler
   uv --directory backend run --env-file ../.env uvicorn app.main:app --reload
   ```

4. In a separate terminal, start the frontend:

   ```sh
   cd frontend
   bun install
   bun run dev
   ```

Open [the app](http://localhost:5173) or [the API docs](http://localhost:8000/docs).


## Tests

Run from the repository root:

```powershell
# All tests
uv --directory backend run pytest -q

# Endpoints
uv --directory backend run pytest tests/routes tests/test_main.py -q

# Pipelines (simulated AI responses; no external services needed)
uv --directory backend run pytest tests/pipelines -q
```

Database tests skip unless `TEST_DATABASE_URL` is set in your shell. Use an existing test database with permission to create schemas; tests roll back their changes.

```powershell
$env:TEST_DATABASE_URL = "postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/estaro_test"
uv --directory backend run pytest -q
```

## App commands

Run these commands from the repository root.

```sh
uv --directory backend run alembic upgrade head

# Import customer and article master data
uv --directory backend run python -m scripts.import_data

# Import document-derived rules
uv --directory backend run python -m scripts.import_rules

uv --directory backend run uvicorn app.main:app --reload

# Local worker (separate terminal; PostgreSQL and Redis must be running)
uv --directory backend run celery -A app.workers.celery_app:celery_app worker --pool=solo --queues=extraction --loglevel=info

# Local scheduler (another terminal; keep running alongside the worker)
# Schedules Outlook fetches when MS_FETCH_ENABLED=true, plus periodic cleanup
uv --directory backend run celery -A app.workers.celery_app:celery_app beat --loglevel=info --schedule="$env:TEMP\estaro-celerybeat-schedule"
```
