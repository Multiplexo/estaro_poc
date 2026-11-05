from email.message import EmailMessage, MIMEPart
from email.parser import BytesParser
from email.policy import default
from pathlib import PureWindowsPath

import structlog
from bs4 import BeautifulSoup
from extract_msg import Message

from app.models.domain.documents import DocumentSection, EmailAttachment, EmailDocument
from app.models.domain.inquiries import FileType

logger = structlog.get_logger(__name__)


def _email_sections(
    headers: list[tuple[str, str, str | None]], body: str
) -> list[DocumentSection]:
    sections = [
        DocumentSection(id=name, text=f"{label}: {value}")
        for name, label, value in headers
        if value
    ]
    if not body.strip():
        return sections
    sections.extend(
        DocumentSection(id=f"email-body-{index}", text=line)
        for index, line in enumerate(
            body.replace("\r\n", "\n").replace("\r", "\n").split("\n"), start=1
        )
    )
    return sections


def _html_text(content: str | bytes) -> str:
    html = BeautifulSoup(content, "html.parser")
    for node in html(["script", "style", "head"]):
        node.decompose()
    return html.get_text(separator="\n")


def _pdf_attachment(filename: str, content: bytes) -> EmailAttachment | None:
    filename = PureWindowsPath(filename).name
    if not content.startswith(b"%PDF-"):
        if filename.lower().endswith(".pdf"):
            raise ValueError("Email PDF attachment must contain a PDF document")
        logger.info("email_attachment_skipped", filename=filename)
        return None
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    return EmailAttachment(filename=filename, content=content)


def _mime_body_text(part: MIMEPart | None) -> str:
    if part is None:
        return ""
    payload = part.get_content()
    if not isinstance(payload, str):
        raise TypeError("Email body must contain readable text")
    return _html_text(payload) if part.get_content_type() == "text/html" else payload


def _parse_mime_email(content: bytes, include_attachments: bool) -> EmailDocument:
    message = BytesParser(policy=default).parsebytes(content)
    if not isinstance(message, EmailMessage) or not any(
        message.get(header)
        for header in ("From", "To", "Subject", "Date", "Message-ID")
    ):
        raise ValueError("EML file must contain an email message")
    headers = [
        (name, label, str(message[header]) if message[header] else None)
        for name, label, header in (
            ("sender", "Von", "From"),
            ("to", "An", "To"),
            ("cc", "Cc", "Cc"),
            ("date", "Datum", "Date"),
            ("subject", "Betreff", "Subject"),
        )
    ]
    body_part = message.get_body(preferencelist=("plain",))
    body = _mime_body_text(body_part)
    if not body.strip():
        body_part = message.get_body(preferencelist=("html",))
        body = _mime_body_text(body_part)
    attachments: list[EmailAttachment] = []
    if include_attachments:
        for index, part in enumerate(message.walk(), start=1):
            if part.is_multipart() or part is body_part:
                continue
            data = part.get_payload(decode=True)
            filename = part.get_filename() or f"attachment-{index}"
            if (
                part.get_content_type() == "application/pdf"
                and not filename.lower().endswith(".pdf")
            ):
                filename += ".pdf"
            if not isinstance(data, bytes):
                if filename.lower().endswith(".pdf"):
                    raise ValueError("Email PDF attachment could not be decoded")
                continue
            attachment = _pdf_attachment(filename, data)
            if attachment:
                attachments.append(attachment)
    return EmailDocument(
        sections=_email_sections(headers, body), attachments=attachments
    )


def parse_email(
    content: bytes,
    file_type: FileType = FileType.MSG,
    *,
    include_attachments: bool = True,
) -> EmailDocument:
    if file_type == FileType.EML:
        try:
            email = _parse_mime_email(content, include_attachments)
        except Exception as exc:
            logger.exception("email_parsing_failed", file_type=file_type)
            raise ValueError("EML email could not be read") from exc
        logger.info(
            "email_parsed",
            file_type=file_type,
            section_count=len(email.sections),
            pdf_count=len(email.attachments),
        )
        return email
    if file_type != FileType.MSG:
        raise ValueError("Email format must be MSG or EML")
    try:
        with Message(content, delayAttachments=True) as message:
            if not isinstance(message, Message) or not (
                message.classType or ""
            ).startswith("IPM.Note"):
                raise ValueError("MSG file must contain an email message")
            headers = [
                ("sender", "Von", message.sender),
                ("to", "An", message.to),
                ("cc", "Cc", message.cc),
                ("date", "Datum", message.date.isoformat() if message.date else None),
                ("subject", "Betreff", message.subject),
            ]
            body = message.body or ""
            if not body.strip() and message.htmlBody:
                body = _html_text(message.htmlBody)
            sections = _email_sections(headers, body)
            attachments: list[EmailAttachment] = []
            if include_attachments:
                for index, attachment in enumerate(message.attachments, start=1):
                    filename = PureWindowsPath(
                        attachment.longFilename
                        or attachment.shortFilename
                        or f"attachment-{index}"
                    ).name
                    data = attachment.data
                    if not isinstance(data, bytes):
                        logger.info("email_attachment_skipped", filename=filename)
                        continue
                    pdf = _pdf_attachment(filename, data)
                    if pdf:
                        attachments.append(pdf)
    except Exception as exc:
        logger.exception("email_parsing_failed")
        raise ValueError("MSG email could not be read") from exc

    if include_attachments and not sections and not attachments:
        raise ValueError("MSG email must contain text or PDF attachments")
    logger.info("email_parsed", section_count=len(sections), pdf_count=len(attachments))
    return EmailDocument(sections=sections, attachments=attachments)
