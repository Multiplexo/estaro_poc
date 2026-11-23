from sqlalchemy import Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models.domain.terms import ArticleTerm as ArticleTermModel
from app.models.domain.terms import TermKind


class ArticleTerm(SQLModel, table=True):
    __tablename__ = "article_term"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        UniqueConstraint(
            "kind",
            "code",
            "substitute_for",
            name="uq_article_term",
            postgresql_nulls_not_distinct=True,
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    kind: str = Field(sa_type=Text, index=True)
    code: str = Field(sa_type=Text)
    synonyms: list[str] = Field(default_factory=list, sa_type=JSONB)
    article_number: str | None = Field(default=None, sa_type=Text)
    substitute_for: str | None = Field(default=None, sa_type=Text)

    def to_model(self) -> ArticleTermModel:
        return ArticleTermModel(
            kind=TermKind(self.kind),
            code=self.code,
            synonyms=list(self.synonyms),
            article_number=self.article_number,
            substitute_for=self.substitute_for,
        )
