from pydantic import BaseModel, Field


class DocumentSection(BaseModel):
    id: str
    text: str


class EmailAttachment(BaseModel):
    filename: str
    content: bytes


class EmailDocument(BaseModel):
    sections: list[DocumentSection]
    attachments: list[EmailAttachment] = Field(default_factory=list)
