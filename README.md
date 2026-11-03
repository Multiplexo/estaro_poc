# App commands

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
```
