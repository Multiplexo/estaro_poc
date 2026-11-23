from enum import StrEnum

from pydantic import BaseModel, Field, computed_field


class UserRole(StrEnum):
    ADMIN = "admin"
    USER = "bearbeiter"


class CurrentUser(BaseModel):
    id: str = Field(description="Stable Entra object ID of the user")
    name: str
    email: str | None = None
    roles: list[UserRole] = Field(default_factory=list)

    @computed_field
    @property
    def is_admin(self) -> bool:
        return UserRole.ADMIN in self.roles


class LoginState(BaseModel):
    state: str
    nonce: str
    verifier: str
    redirect_path: str = "/"
