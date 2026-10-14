"""FastAPI dependencies: DB session, authentication and RBAC."""
from datetime import date
from typing import Literal

import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import RoleName
from app.core.security import ACCESS_TOKEN, decode_token
from app.db.session import get_db
from app.models import User
from app.schemas.response import ResponseFilters

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials.",
    headers={"WWW-Authenticate": "Bearer"},
)


def _user_from_token(db: Session, token: str) -> User:
    try:
        payload = decode_token(token, ACCESS_TOKEN)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise CREDENTIALS_EXCEPTION
    user = db.get(User, user_id)
    if user is None:
        raise CREDENTIALS_EXCEPTION
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been deactivated.")
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    return _user_from_token(db, token)


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)
) -> User | None:
    """For public endpoints: returns the user when a valid token is sent, else None."""
    return _user_from_token(db, token) if token else None


def require_roles(*roles: RoleName):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role_name not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to perform this action.")
        return user

    return checker


require_admin = require_roles(RoleName.ADMIN)


class Pagination:
    def __init__(self, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
        self.page = page
        self.size = size


def response_filters(
    search: str | None = Query(None, max_length=200, description="Search answers, submitter name/email or response id"),
    date_from: date | None = Query(None, description="YYYY-MM-DD"),
    date_to: date | None = Query(None, description="YYYY-MM-DD (inclusive)"),
    submitted_by: int | None = Query(None, description="Submitter user id"),
    submitter_type: Literal["all", "authenticated", "anonymous"] = Query("all"),
    field_key: str | None = Query(None, description="Filter by a specific field..."),
    field_value: str | None = Query(None, description="...containing this value"),
    sort_by: Literal["created_at", "updated_at", "id"] = Query("created_at"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
) -> ResponseFilters:
    return ResponseFilters(
        search=search, date_from=date_from, date_to=date_to, submitted_by=submitted_by,
        submitter_type=submitter_type, field_key=field_key, field_value=field_value,
        sort_by=sort_by, sort_order=sort_order,
    )
