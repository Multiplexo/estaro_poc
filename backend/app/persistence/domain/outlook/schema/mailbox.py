from sqlalchemy import Text
from sqlmodel import Field, SQLModel


class OutlookMailbox(SQLModel, table=True):
    __tablename__ = "outlook_mailbox"  # pyright: ignore[reportAssignmentType]

    id: int = Field(default=1, primary_key=True)
    account_id: str = Field(sa_type=Text)
    refresh_token: str = Field(sa_type=Text, repr=False)
    delta_link: str | None = Field(default=None, sa_type=Text)
