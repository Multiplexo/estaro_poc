```text
backend/
├── app/                  # Application code
│   ├── models/           # Pydantic data models
│   │   ├── api/          # HTTP request and response shapes
│   │   ├── domain/       # Articles, customers, and inquiries
│   │   ├── jobs/         # Background job status and progress
│   │   └── shared/       # Common models, such as pagination
│   ├── persistence/      # Database schemas and async repositories
│   │   ├── domain/       # Business data storage and queries
│   │   └── jobs/         # Job status storage and queries
│   ├── pipelines/        # Processing steps and their execution order
│   ├── routes/           # FastAPI endpoints
│   ├── services/         # Application logic coordinating repositories and jobs
│   │   ├── domain/       # Business operations for articles, customers, and inquiries
│   │   ├── jobs/         # Job submission and status retrieval
│   │   └── shared/       # Shared services, such as database connections
│   └── workers/          # Celery setup and task entry points
├── alembic/              # Database migrations
└── scripts/              # Standalone utilities, such as data import
```

