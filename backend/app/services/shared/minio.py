from datetime import timedelta
from io import BytesIO
from pathlib import PurePath
from typing import BinaryIO
from urllib.parse import quote
from uuid import UUID

import structlog
from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from minio import Minio
from minio.error import MinioException, S3Error
from urllib3.exceptions import HTTPError

from app.config import Settings
from app.models.domain.inquiries import FileType

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

    async def upload_object(
        self, source_key: str, content: bytes, content_type: str
    ) -> None:
        if not source_key:
            raise ValueError("File source key must be set")
        try:
            await run_in_threadpool(
                self._put_object,
                source_key,
                BytesIO(content),
                len(content),
                content_type,
            )
        except (MinioException, HTTPError, OSError):
            logger.exception("object_upload_failed", source_key=source_key)
            raise

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

    async def validate_file(self, file: UploadFile) -> FileType:
        suffix = PurePath(file.filename or "").suffix.lower().lstrip(".")
        if suffix not in {FileType.PDF, FileType.MSG, FileType.EML}:
            raise ValueError("File must be a PDF, MSG or EML email")
        file_type = FileType(suffix)
        if file.size is None or file.size <= 0:
            raise ValueError("File must not be empty")
        if file_type == FileType.EML:
            await file.seek(0)
            return file_type
        await file.seek(0)
        signature = await file.read(8)
        await file.seek(0)
        expected = (
            b"%PDF-"
            if file_type == FileType.PDF
            else b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
        )
        if not signature.startswith(expected):
            raise ValueError("File content does not match its PDF or MSG extension")
        return file_type

    async def upload_inquiry_file(self, document_id: UUID, file: UploadFile) -> str:
        object_name = str(document_id)
        try:
            file_type = await self.validate_file(file)
            if file.size is None:
                raise ValueError("File size must be known")
            await run_in_threadpool(
                self._upload_file, object_name, file, file.size, file_type.media_type
            )
        except (MinioException, HTTPError, OSError):
            logger.exception("inquiry_file_upload_failed", document_id=object_name)
            raise
        logger.info("inquiry_file_uploaded", document_id=object_name)
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

    def _upload_file(
        self, object_name: str, file: UploadFile, file_size: int, media_type: str
    ) -> None:
        self._put_object(object_name, file.file, file_size, media_type)

    def _put_object(
        self,
        object_name: str,
        content: BinaryIO,
        size: int,
        content_type: str,
    ) -> None:
        if not self._client.bucket_exists(self._bucket):
            try:
                self._client.make_bucket(self._bucket)
            except S3Error as exc:
                if exc.code != "BucketAlreadyOwnedByYou":
                    raise
        self._client.put_object(
            self._bucket,
            object_name,
            content,
            length=size,
            content_type=content_type,
        )
