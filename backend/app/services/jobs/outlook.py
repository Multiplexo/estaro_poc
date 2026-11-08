import re
from datetime import UTC, datetime
from functools import partial
from hashlib import sha256
from io import BytesIO

import structlog
from fastapi import UploadFile
from kiota_abstractions.api_error import APIError
from kiota_abstractions.base_request_configuration import RequestConfiguration
from msgraph.generated.models.file_attachment import FileAttachment
from msgraph.generated.models.item_attachment import ItemAttachment
from msgraph.generated.models.o_data_errors.o_data_error import ODataError
from msgraph.generated.models.reference_attachment import ReferenceAttachment
from msgraph.generated.users.item.mail_folders.item.messages.delta.delta_request_builder import (
    DeltaRequestBuilder,
)
from msgraph.generated.users.item.messages.item.attachments.attachments_request_builder import (
    AttachmentsRequestBuilder,
)

from app.models.domain.outlook import (
    FetchedOutlookMessage,
    OutlookAttachment,
    OutlookFetchPageResult,
    OutlookMessage,
)
from app.persistence.domain.outlook.outlook_repository import OutlookRepository
from app.persistence.domain.outlook.schema.mailbox import OutlookMailbox
from app.services.jobs.uploads import ExtractionUploadService
from app.services.shared.minio import MinioService
from app.services.shared.outlook import OutlookClient, serialize_graph_model

logger = structlog.get_logger(__name__)


class OutlookFetchService:
    def __init__(
        self,
        repository: OutlookRepository,
        outlook: OutlookClient,
        storage: MinioService,
        inputs: ExtractionUploadService,
    ) -> None:
        self.repository = repository
        self.outlook = outlook
        self.storage = storage
        self.inputs = inputs

    async def fetch(self) -> None:
        if not self.outlook.settings.MS_FETCH_ENABLED:
            return
        self.outlook.validate_configuration()
        fetched = 0
        while True:
            result = await self._fetch_page()
            fetched += result.message_count
            if not result.has_more:
                break
        logger.info("outlook_fetch_finished", message_count=fetched)

    async def _fetch_page(self) -> OutlookFetchPageResult:
        connection = await self.repository.lock_connection()
        if connection is None:
            logger.info("outlook_connection_unavailable")
            return OutlookFetchPageResult()

        tokens = await self.outlook.refresh(connection.refresh_token)
        if tokens.refresh_token:
            connection.refresh_token = self.outlook.encrypt_token(tokens.refresh_token)
        try:
            result = await self._download_page(connection)
        except Exception:
            # Keep rotated refresh tokens even when fetching or storing a page fails.
            await self.repository.save(connection)
            raise
        await self.repository.save(connection)
        return result

    async def _download_page(
        self, connection: OutlookMailbox
    ) -> OutlookFetchPageResult:
        builder = self.outlook.graph.me.mail_folders.by_mail_folder_id(
            "inbox"
        ).messages.delta
        config = RequestConfiguration(
            query_parameters=DeltaRequestBuilder.DeltaRequestBuilderGetQueryParameters(
                select=["id"]
            )
        )
        if connection.delta_link:
            builder = builder.with_url(connection.delta_link)
            config.query_parameters = None
        try:
            page = await self.outlook.request(
                partial(builder.get, request_configuration=config)
            )
        except APIError as exc:
            if exc.response_status_code != 410:
                raise
            connection.delta_link = None
            logger.warning("outlook_delta_expired")
            return OutlookFetchPageResult()

        if page is None or not (page.odata_next_link or page.odata_delta_link):
            raise ValueError("Microsoft Graph did not return a delta checkpoint")
        fetched = 0
        for change in page.value or []:
            if "@removed" in change.additional_data:
                continue
            if not change.id:
                raise ValueError("Microsoft Graph returned a message without an ID")
            if await self._download_message(connection.account_id, change.id):
                fetched += 1

        # Advance only after storage and extraction handoff succeeded for this page.
        connection.delta_link = page.odata_next_link or page.odata_delta_link
        logger.info("outlook_page_fetched", message_count=fetched)
        return OutlookFetchPageResult(
            message_count=fetched, has_more=page.odata_next_link is not None
        )

    async def _download_message(self, account_id: str, message_id: str) -> bool:
        account_key = sha256(account_id.encode()).hexdigest()
        message_key = sha256(message_id.encode()).hexdigest()
        prefix = f"outlook/{account_key}/{message_key}"
        if await self.inputs.resume_email(prefix):
            return False
        builder = self.outlook.graph.me.messages.by_message_id(message_id)
        try:
            response = await self.outlook.request(builder.get)
            mime = await self.outlook.request(builder.content.get)
        except APIError as exc:
            if exc.response_status_code != 404:
                raise
            logger.info("outlook_message_no_longer_available")
            return False

        if response is None or mime is None:
            raise ValueError("Microsoft Graph returned an empty message")
        message = OutlookMessage.model_validate_json(serialize_graph_model(response))
        attachments = await self._download_attachments(message_id, prefix)
        fetched = FetchedOutlookMessage(
            account_id=account_id,
            fetched_at=datetime.now(UTC),
            message=message,
            attachments=attachments,
        )
        await self.storage.upload_object(
            f"{prefix}/message.json",
            fetched.model_dump_json(by_alias=True).encode(),
            "application/json",
        )
        filename = (
            re.sub(r'[\\/:*?"<>|\r\n]', "_", message.subject).strip(" .")[:180]
            or "E-Mail"
        )
        file = UploadFile(
            file=BytesIO(mime),
            filename=f"{filename}.eml",
            size=len(mime),
        )
        try:
            await self.inputs.submit_email(file, prefix)
        finally:
            await file.close()
        return True

    async def _download_attachments(
        self, message_id: str, prefix: str
    ) -> list[OutlookAttachment]:
        collection = self.outlook.graph.me.messages.by_message_id(
            message_id
        ).attachments
        builder = collection
        config = RequestConfiguration(
            query_parameters=AttachmentsRequestBuilder.AttachmentsRequestBuilderGetQueryParameters(
                select=[
                    "id",
                    "name",
                    "contentType",
                    "size",
                    "isInline",
                    "lastModifiedDateTime",
                ]
            )
        )
        attachments: list[OutlookAttachment] = []
        while True:
            page = await self.outlook.request(
                partial(builder.get, request_configuration=config)
            )
            if page is None:
                raise ValueError("Microsoft Graph returned an empty attachment page")
            for item in page.value or []:
                if not item.id:
                    raise ValueError(
                        "Microsoft Graph returned an attachment without an ID"
                    )
                attachment_builder = collection.by_attachment_id(item.id)
                if isinstance(item, ReferenceAttachment):
                    # Cloud links have no downloadable /$value; retain their metadata.
                    item = await self.outlook.request(attachment_builder.get)
                    if item is None:
                        raise ValueError("Microsoft Graph returned an empty attachment")
                attachment = OutlookAttachment.model_validate_json(
                    serialize_graph_model(item)
                )
                if isinstance(item, (FileAttachment, ItemAttachment)):
                    # The SDK has no generated attachment /$value builder.
                    request = attachment_builder.to_get_request_information()
                    request.url = f"{request.url}/$value"
                    request.headers.remove("Accept")
                    request.headers.add("Accept", "application/octet-stream")
                    content = await self.outlook.request(
                        partial(
                            self.outlook.graph.request_adapter.send_primitive_async,
                            request,
                            "bytes",
                            {"4XX": ODataError, "5XX": ODataError},
                        )
                    )
                    if not isinstance(content, bytes):
                        raise TypeError(
                            "Microsoft Graph attachment content must be bytes"
                        )
                    key = sha256(attachment.id.encode()).hexdigest()
                    attachment.source_key = f"{prefix}/attachments/{key}"
                    await self.storage.upload_object(
                        attachment.source_key,
                        content,
                        attachment.content_type or "application/octet-stream",
                    )
                elif not isinstance(item, ReferenceAttachment):
                    raise TypeError("Unsupported Outlook attachment type")
                attachments.append(attachment)
            if not page.odata_next_link:
                break
            builder = collection.with_url(page.odata_next_link)
            config.query_parameters = None
        return attachments
