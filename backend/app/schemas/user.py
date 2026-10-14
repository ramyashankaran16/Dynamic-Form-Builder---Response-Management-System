from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.core.constants import RoleName
from app.schemas.common import ORMModel


class RoleOut(ORMModel):
    id: int
    name: str
    description: str | None = None


class UserOut(ORMModel):
    id: int
    full_name: str
    email: EmailStr
    role: str | None = Field(default=None, validation_alias="role_name")
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    role: RoleName | None = None
    is_active: bool | None = None
