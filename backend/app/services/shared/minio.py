from datetime import timedelta
from urllib.parse import quote
from uuid import UUID

import structlog
from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from minio import Minio
from minio.error import MinioException, S3Error
from urllib3.exceptions import HTTPError

from app.config import Settings

logger = structlog.get_logger(__name__)


class MinioService:
    def __init__(self, settings: Settings) -> None:
        self._bucket = settings.MINIO_BUCKET
        self._client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self._public_client = Minio(
            settings.MINIO_PUBLIC_ENDPOINT or settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=(
                settings.MINIO_PUBLIC_SECURE
                if settings.MINIO_PUBLIC_SECURE is not None
                else settings.MINIO_SECURE
            ),
            region=settings.MINIO_REGION,
        )

    async def get_inquiry_file_url(
        self, source_key: str, filename: str, media_type: str
    ) -> str:
        if not source_key:
            raise ValueError("File source key must be set")
        try:
            return await run_in_threadpool(
                self._public_client.presigned_get_object,
                self._bucket,
                source_key,
                expires=timedelta(hours=1),
                response_headers={
                    "response-content-type": media_type,
                    "response-content-disposition": (
                        f"inline; filename*=UTF-8''{quote(filename, safe='')}"
                    ),
                },
            )
        except (MinioException, HTTPError, OSError):
            logger.exception("inquiry_file_url_failed", source_key=source_key)
            raise

    async def upload_inquiry_file(self, inquiry_id: UUID, file: UploadFile) -> str:
        if file.content_type != "application/pdf":
            raise ValueError("File must have content type application/pdf")
        if file.size is None or file.size <= 0:
            raise ValueError("PDF file must not be empty")

        object_name = str(inquiry_id)
        try:
            await file.seek(0)
            signature = await file.read(5)
            await file.seek(0)
            if signature != b"%PDF-":
                raise ValueError("File must contain a PDF document")
            await run_in_threadpool(self._upload_file, object_name, file, file.size)
        except (MinioException, HTTPError, OSError):
            logger.exception("inquiry_file_upload_failed", inquiry_id=object_name)
            raise

        logger.info("inquiry_file_uploaded", inquiry_id=object_name)
        return object_name

    async def get_inquiry_file(self, source_key: str) -> bytes:
        if not source_key:
            raise ValueError("File source key must be set")
        try:
            return await run_in_threadpool(self._download_file, source_key)
        except (MinioException, HTTPError, OSError):
            logger.exception("inquiry_file_download_failed", source_key=source_key)
            raise

    async def delete_inquiry_file(self, source_key: str) -> None:
        if not source_key:
            raise ValueError("File source key must be set")
        try:
            await run_in_threadpool(
                self._client.remove_object, self._bucket, source_key
            )
        except S3Error as exc:
            if exc.code in {"NoSuchKey", "NoSuchObject", "NoSuchBucket"}:
                return
            logger.exception("inquiry_file_delete_failed", source_key=source_key)
            raise
        except (MinioException, HTTPError, OSError):
            logger.exception("inquiry_file_delete_failed", source_key=source_key)
            raise

        logger.info("inquiry_file_deleted", source_key=source_key)

    def _download_file(self, source_key: str) -> bytes:
        response = self._client.get_object(self._bucket, source_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def _upload_file(self, object_name: str, file: UploadFile, file_size: int) -> None:
        if not self._client.bucket_exists(self._bucket):
            try:
                self._client.make_bucket(self._bucket)
            except S3Error as exc:
                if exc.code != "BucketAlreadyOwnedByYou":
                    raise
        self._client.put_object(
            self._bucket,
            object_name,
            file.file,
            length=file_size,
            content_type="application/pdf",
        )
