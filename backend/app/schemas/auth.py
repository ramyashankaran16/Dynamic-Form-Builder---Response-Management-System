from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserOut


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=150, examples=["John Doe"])
    email: EmailStr = Field(examples=["john@formbuilder.com"])
    password: str = Field(min_length=8, max_length=72, examples=["Password@123"])


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str
