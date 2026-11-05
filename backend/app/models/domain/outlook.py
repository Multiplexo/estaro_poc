from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OutlookTokens(BaseModel):
    model_config = ConfigDict(hide_input_in_errors=True)

    access_token: str = Field(repr=False, min_length=1)
    refresh_token: str | None = Field(default=None, repr=False)
    expires_in: int = Field(gt=0)


class OutlookAccount(BaseModel):
    id: str


class OutlookConnectionStatus(BaseModel):
    connected: bool
    configured: bool
    fetch_enabled: bool
    fetch_interval_seconds: int


class OutlookFetchPageResult(BaseModel):
    message_count: int = Field(default=0, ge=0)
    has_more: bool = False


class OutlookBody(BaseModel):
    content: str
    content_type: str = Field(alias="contentType")


class OutlookMessage(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    subject: str = ""
    body: OutlookBody
    received_at: datetime | None = Field(default=None, alias="receivedDateTime")


class OutlookAttachment(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    kind: str = Field(alias="@odata.type")
    content_type: str | None = Field(default=None, alias="contentType")
    size: int = 0
    is_inline: bool = Field(default=False, alias="isInline")
    source_key: str | None = None


class FetchedOutlookMessage(BaseModel):
    account_id: str
    fetched_at: datetime
    message: OutlookMessage
    attachments: list[OutlookAttachment]
