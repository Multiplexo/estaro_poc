from io import BytesIO

import structlog
from docling.datamodel.accelerator_options import AcceleratorOptions
from docling.datamodel.base_models import ConversionStatus, DocumentStream, InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.exceptions import ConversionError
from docling_core.transforms.serializer.doctags import (
    DocTagsDocSerializer,
    DocTagsParams,
)
from docling_core.types.doc.document import DoclingDocument
from docling_core.types.doc.items.node import DocItem

from app.models.domain.inquiries import InquiryDocument
from app.models.jobs.extraction import (
    CitationBBox,
    CitationSource,
    ClassifiedDocument,
)
from app.services.shared.email import parse_email

logger = structlog.get_logger(__name__)


def _convert_document(document: bytes) -> DoclingDocument:
    pipeline_options = PdfPipelineOptions(
        accelerator_options=AcceleratorOptions(num_threads=16),
        generate_page_images=True,
        images_scale=2.0,
    )
    converter = DocumentConverter(
        allowed_formats=[InputFormat.PDF],
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        },
    )
    with BytesIO(document) as stream:
        result = converter.convert(DocumentStream(name="inquiry.pdf", stream=stream))
    if result.status != ConversionStatus.SUCCESS:
        raise ConversionError("PDF conversion did not complete successfully")
    return result.document


def _get_page_images(document: DoclingDocument) -> list[str]:
    page_images: list[str] = []
    for page_number in sorted(document.pages):
        page = document.pages[page_number]
        if page.image is None:
            raise ConversionError(f"Missing image for PDF page {page_number}")
        image_uri = str(page.image.uri)
        if not image_uri.startswith("data:image/png;base64,"):
            raise ConversionError(f"Expected an inline PNG for PDF page {page_number}")
        page_images.append(image_uri)
    if not page_images:
        raise ConversionError("PDF conversion did not produce any page images")
    return page_images


def _build_classified_document(
    document: DoclingDocument, document_id: str
) -> ClassifiedDocument:
    serializer = DocTagsDocSerializer(
        doc=document, params=DocTagsParams(add_table_cell_location=True)
    )
    sections: list[str] = []
    sources: dict[str, CitationSource] = {}
    for item_index, (item, _) in enumerate(document.iterate_items(), start=1):
        if not isinstance(item, DocItem) or not item.prov:
            continue
        doctags = serializer.serialize(item=item).text
        if not doctags.strip():
            continue
        for provenance_index, provenance in enumerate(item.prov, start=1):
            page = document.pages[provenance.page_no]
            bbox = provenance.bbox.to_top_left_origin(page_height=page.size.height)
            section_id = (
                f"page-{provenance.page_no}-item-{item_index}-prov-{provenance_index}"
            )
            sections.append(f"section_id={section_id}\n{doctags}")
            sources[section_id] = CitationSource(
                page_number=provenance.page_no,
                page_width=page.size.width,
                page_height=page.size.height,
                bbox=CitationBBox(l=bbox.l, t=bbox.t, r=bbox.r, b=bbox.b),
            )
    return ClassifiedDocument(
        document_id=document_id,
        content="\n".join(sections),
        page_images=_get_page_images(document),
        sources=sources,
    )


def document_classification(
    document: bytes, source: InquiryDocument
) -> ClassifiedDocument:
    if source.file_type.is_email:
        email = parse_email(document, source.file_type, include_attachments=False)
        return ClassifiedDocument(
            document_id=str(source.id),
            content="\n\n".join(
                f"section_id={section.id}\n{section.text}"
                for section in email.sections
                if section.text.strip()
            ),
            sources={
                section.id: CitationSource(text=section.text)
                for section in email.sections
                if section.text.strip()
            },
        )
    if not document.startswith(b"%PDF-"):
        raise ValueError("Document must contain a PDF")

    try:
        converted = _convert_document(document)
        classified = _build_classified_document(converted, str(source.id))
    except Exception:
        logger.exception("extraction_doctags_conversion_failed")
        raise

    logger.info(
        "extraction_doctags_converted",
        characters=len(classified.content),
        page_count=len(classified.page_images),
        source_count=len(classified.sources),
    )
    return classified
