from typing import Any, Literal, get_args

from pydantic import BaseModel

from app.models.domain.articles import Article
from app.models.domain.customers import Customer
from app.models.domain.extraction_review import ExtractionReview
from app.models.domain.inquiry_data import (
    InquiryData,
    InquiryFieldMatch,
    InquiryPosition,
)
from app.models.jobs.extraction import InquiryExtraction, extraction_fields


def map_extraction_to_inquiry(
    extraction: InquiryExtraction,
    review: ExtractionReview | None = None,
    existing: InquiryData | None = None,
    updated_fields: set[str] | None = None,
) -> InquiryData:
    data = existing.model_copy(deep=True) if existing else InquiryData()
    data.quellsprache = extraction.quellsprache.model_copy(deep=True)
    reviewed = review.fields if review else {}
    values = {
        name: reviewed[name].value if name in reviewed else field.value
        for name, field in extraction_fields(extraction)
    }
    assignments = {
        "kundeninformationen.name": ("customer",),
        "kundeninformationen.kunde": ("customer_number",),
        "kundeninformationen.ansprechpartner": ("contact_name",),
        "kundeninformationen.zusatz": ("contact_email", "contact_phone"),
        "kundeninformationen.ort.stadt": ("customer_location",),
        "beleginformationen.lieferdatum": ("delivery_date",),
        "belegdetails.ihreBelegnummer": ("document_number", "inquiry_number"),
        "belegdetails.belegZu": ("reference_number",),
        "angebotsdetails.angebotGueltigBis": ("offer_valid_until",),
        "kopftext": ("requirements",),
    }
    position_fields = {
        "bezeichnung": "article",
        "bezeichnung2": "material",
        "dimensionstext": "dimensions",
        "menge": "quantity",
        "mengeneinheit": "unit",
        "langtext": "requirements",
        "zusatzinfos": "alternatives",
        "zeugnis": "certificates",
    }
    positions = data.positionen or []
    data.positionen = [
        positions[index] if index < len(positions) else InquiryPosition()
        for index in range(len(extraction.positionen))
    ]
    for index, position in enumerate(extraction.positionen):
        data.positionen[index].quellsprache = position.quellsprache.model_copy(
            deep=True
        )
        assignments.update(
            {
                f"positionen.{index}.{target}": (f"item-{index}-{name}",)
                for target, name in position_fields.items()
            }
        )
    payload = data.model_dump(mode="json")
    for path, names in assignments.items():
        if updated_fields is not None and not updated_fields.intersection(names):
            continue
        if path == "kundeninformationen.zusatz":
            value = "\n".join(filter(None, (values[name] for name in names))) or None
        elif len(names) == 1:
            value = values[names[0]]
        else:
            value = next((values[name] for name in names if values[name]), None)
        _set_value(payload, path, value)
    allowed = inquiry_data_field_ids(len(extraction.positionen))
    for field_id, field in reviewed.items():
        if field_id not in allowed:
            continue
        if updated_fields is not None and field_id not in updated_fields:
            continue
        _set_value(payload, field_id.removeprefix("data:"), field.value or None)
    payload["matching_provenance"] = {
        path: match
        for path, match in payload["matching_provenance"].items()
        if f"data:{path}" in allowed
    }
    return InquiryData.model_validate(payload)


def map_customer_to_inquiry(
    data: InquiryData,
    customer: Customer,
    *,
    origin: Literal["automatic", "manual"] = "automatic",
) -> InquiryData:
    values = {
        "kundeninformationen.kunde": customer.customer_number,
        "kundeninformationen.anrede": customer.salutation,
        "kundeninformationen.name": customer.name,
        "kundeninformationen.namenszusatz": customer.name_addition,
        "kundeninformationen.ort.land": customer.country_code or customer.country_name,
        "kundeninformationen.ort.postleitzahl": customer.postal_code,
        "kundeninformationen.ort.stadt": customer.city,
        "beleginformationen.zahlungskondition": (
            customer.payment_terms_code or customer.payment_terms_name
        ),
        "beleginformationen.druckprozessVariante": customer.print_process_variant_code,
        "belegdetails.sprache": customer.language_code or customer.language_name,
        "preisUndSteuerbasis.besteuerungsart": (
            customer.taxation_type_code or customer.taxation_type_name
        ),
        "preisUndSteuerbasis.euUstidNr": customer.vat_id,
        "preisUndSteuerbasis.euLaenderkuerzel": customer.eu_country_code,
        "preisUndSteuerbasis.waehrung": customer.currency_code
        or customer.currency_name,
    }
    return _apply_matched_values(
        data, values, "customer", str(customer.id), customer.customer_number, origin
    )


def map_article_to_inquiry(
    data: InquiryData,
    article: Article,
    position_index: int,
    *,
    origin: Literal["automatic", "manual"] = "automatic",
) -> InquiryData:
    positions = data.positionen
    if not positions or not 0 <= position_index < len(positions):
        raise ValueError("Matched article requires a valid inquiry position")
    position = positions[position_index]
    values = {
        f"positionen.{position_index}.artikel": article.article_number,
        f"positionen.{position_index}.bezeichnung": article.description_1,
        f"positionen.{position_index}.bezeichnung2": article.description_2,
        f"positionen.{position_index}.lagerbestand": str(article.stock_quantity),
        f"positionen.{position_index}.lagerinfoPOS": article.main_storage_location,
    }
    # Requested quantities and units belong together; no unit conversion is available.
    if not position.mengeneinheit:
        values[f"positionen.{position_index}.mengeneinheit"] = (
            article.sales_unit_code or article.sales_unit_name
        )
    return _apply_matched_values(
        data, values, "article", str(article.id), article.article_number, origin
    )


def _apply_matched_values(
    data: InquiryData,
    values: dict[str, str | None],
    category: Literal["customer", "article"],
    entity_id: str,
    number: str,
    origin: Literal["automatic", "manual"],
) -> InquiryData:
    payload = data.model_dump(mode="json")
    for path, value in values.items():
        if value is None or not value.strip():
            if origin == "automatic":
                continue
            value = ""
        original: Any = payload
        for part in path.split("."):
            if original is None:
                break
            original = (
                original[int(part)]
                if isinstance(original, list)
                else original.get(part)
            )
        previous = data.matching_provenance.get(path)
        match = InquiryFieldMatch(
            origin=origin,
            category=category,
            entity_id=entity_id,
            number=number,
            value=value,
            original_value=(
                previous.original_value
                if previous is not None and previous.value == original
                else original
            ),
        )
        _set_value(payload, path, value)
        payload["matching_provenance"][path] = match.model_dump(mode="json")
    return InquiryData.model_validate(payload)


def _set_value(payload: dict[str, Any], path: str, value: str | None) -> None:
    parts = path.split(".")
    target: Any = payload
    for part in parts[:-1]:
        if isinstance(target, list):
            target = target[int(part)]
        else:
            if target.get(part) is None:
                target[part] = {}
            target = target[part]
    target[parts[-1]] = value
    match = payload.get("matching_provenance", {}).get(path)
    if match is not None and match["value"] != value:
        payload["matching_provenance"].pop(path)


def inquiry_data_field_ids(position_count: int) -> set[str]:
    return {f"data:{path}" for path in _model_field_paths(InquiryData)} | {
        f"data:positionen.{index}.{name}"
        for index in range(position_count)
        for name in InquiryPosition.model_fields
        if name != "quellsprache"
    }


def _model_field_paths(model: type[BaseModel], prefix: str = "") -> list[str]:
    paths = []
    for name, field in model.model_fields.items():
        if name in {"positionen", "matching_provenance", "quellsprache"}:
            continue
        annotation = next(
            (arg for arg in get_args(field.annotation) if arg is not type(None)),
            field.annotation,
        )
        path = f"{prefix}{name}"
        if isinstance(annotation, type) and issubclass(annotation, BaseModel):
            paths.extend(_model_field_paths(annotation, f"{path}."))
        else:
            paths.append(path)
    return paths
