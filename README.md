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
