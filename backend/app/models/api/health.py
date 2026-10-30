"""Response model for the API root."""

from pydantic import BaseModel


class RootResponse(BaseModel):
    """Basic application response."""

    message: str = "Hello World"
