from pydantic import BaseModel


class DocumentUrl(BaseModel):
    url: str
