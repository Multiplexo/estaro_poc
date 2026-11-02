from typing import Any, get_args

from pydantic import BaseModel

from app.models.domain.extraction_review import ExtractionReview
from app.models.domain.inquiry_data import (
    Angebotsdetails,
    Belegdetails,
    Beleginformationen,
    InquiryData,
    InquiryPosition,
    Kundeninformationen,
    Ort,
)
from app.models.jobs.extraction import InquiryExtraction, extraction_fields


def map_extraction_to_inquiry(
    extraction: InquiryExtraction,
    review: ExtractionReview | None = None,
    existing: InquiryData | None = None,
) -> InquiryData:
    data = existing.model_copy(deep=True) if existing else InquiryData()
    reviewed = review.fields if review else {}
    values = {
        name: reviewed[name].value if name in reviewed else field.value
        for name, field in extraction_fields(extraction)
    }
    customer = data.kundeninformationen or Kundeninformationen()
    customer.name = values["customer"]
    customer.kunde = values["customer_number"]
    customer.ansprechpartner = values["contact_name"]
    customer.zusatz = (
        "\n".join(filter(None, [values["contact_email"], values["contact_phone"]]))
        or None
    )
    customer.ort = customer.ort or Ort()
    customer.ort.stadt = values["customer_location"]
    data.kundeninformationen = customer
    data.beleginformationen = data.beleginformationen or Beleginformationen()
    data.beleginformationen.lieferdatum = values["delivery_date"]
    data.belegdetails = data.belegdetails or Belegdetails()
    data.belegdetails.ihreBelegnummer = (
        values["document_number"] or values["inquiry_number"]
    )
    data.belegdetails.belegZu = values["reference_number"]
    data.angebotsdetails = data.angebotsdetails or Angebotsdetails()
    data.angebotsdetails.angebotGueltigBis = values["offer_valid_until"]
    data.kopftext = values["requirements"]
    positions = []
    for index, _ in enumerate(extraction.positionen):
        position = (
            data.positionen[index]
            if data.positionen and index < len(data.positionen)
            else InquiryPosition()
        )
        position.bezeichnung = values[f"item-{index}-article"]
        position.bezeichnung2 = values[f"item-{index}-material"]
        position.dimensionstext = values[f"item-{index}-dimensions"]
        position.menge = values[f"item-{index}-quantity"]
        position.mengeneinheit = values[f"item-{index}-unit"]
        position.langtext = values[f"item-{index}-requirements"]
        position.zusatzinfos = values[f"item-{index}-alternatives"]
        position.zeugnis = values[f"item-{index}-certificates"]
        positions.append(position)
    data.positionen = positions
    payload = data.model_dump(mode="json")
    allowed = inquiry_data_field_ids(len(extraction.positionen))
    for field_id, field in reviewed.items():
        if field_id not in allowed:
            continue
        parts = field_id.removeprefix("data:").split(".")
        target: Any = payload
        for part in parts[:-1]:
            if isinstance(target, list):
                target = target[int(part)]
            else:
                if target.get(part) is None:
                    target[part] = {}
                target = target[part]
        target[parts[-1]] = field.value or None
    return InquiryData.model_validate(payload)


def inquiry_data_field_ids(position_count: int) -> set[str]:
    return {f"data:{path}" for path in _model_field_paths(InquiryData)} | {
        f"data:positionen.{index}.{name}"
        for index in range(position_count)
        for name in InquiryPosition.model_fields
    }


def _model_field_paths(model: type[BaseModel], prefix: str = "") -> list[str]:
    paths = []
    for name, field in model.model_fields.items():
        if name == "positionen":
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
