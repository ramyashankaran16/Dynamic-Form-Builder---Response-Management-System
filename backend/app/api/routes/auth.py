import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.constants import Action, EntityType, RoleName
from app.core.security import (
    REFRESH_TOKEN, create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
)
from app.models import Role, User
from app.schemas.auth import RefreshRequest, RegisterRequest, TokenResponse
from app.schemas.common import MessageResponse
from app.schemas.user import ChangePasswordRequest, UserOut, UserProfileUpdate
from app.services.activity_service import log_activity
from app.utils.time import utcnow

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role_name),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Self-registration. New accounts always get the **User** role."""
    email = payload.email.lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    role = db.scalar(select(Role).where(Role.name == RoleName.USER))
    if role is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Roles are not seeded. Run `python -m app.db.init_db`.")
    user = User(full_name=payload.full_name.strip(), email=email, hashed_password=hash_password(payload.password), role=role)
    db.add(user)
    db.flush()
    log_activity(db, action=Action.USER_REGISTERED, user=user, entity_type=EntityType.USER, entity_id=user.id,
                 description=f"{user.full_name} registered", request=request)
    db.commit()
    return user


@router.post("/login", response_model=TokenResponse)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 password flow (form fields `username` = email, `password`). Works with Swagger's **Authorize** button."""
    user = db.scalar(select(User).where(func.lower(User.email) == form_data.username.strip().lower()))
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.", headers={"WWW-Authenticate": "Bearer"})
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been deactivated.")
    user.last_login_at = utcnow()
    log_activity(db, action=Action.USER_LOGIN, user=user, entity_type=EntityType.USER, entity_id=user.id,
                 description=f"{user.full_name} logged in", request=request)
    db.commit()
    return _tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token, REFRESH_TOKEN)
        user = db.get(User, int(data["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        user = None
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token.")
    return _tokens(user)


@router.post("/logout", response_model=MessageResponse)
def logout(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """JWTs are stateless: the client discards its tokens. This endpoint records the event."""
    log_activity(db, action=Action.USER_LOGOUT, user=user, entity_type=EntityType.USER, entity_id=user.id,
                 description=f"{user.full_name} logged out", request=request)
    db.commit()
    return {"message": "Logged out."}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_me(payload: UserProfileUpdate, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    old = user.full_name
    user.full_name = payload.full_name.strip()
    log_activity(db, action=Action.PROFILE_UPDATED, user=user, entity_type=EntityType.USER, entity_id=user.id,
                 description="Profile updated", old_values={"full_name": old}, new_values={"full_name": user.full_name},
                 request=request)
    db.commit()
    return user


@router.post("/me/change-password", response_model=MessageResponse)
def change_password(payload: ChangePasswordRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect.")
    user.hashed_password = hash_password(payload.new_password)
    log_activity(db, action=Action.PASSWORD_CHANGED, user=user, entity_type=EntityType.USER, entity_id=user.id,
                 description="Password changed", request=request)
    db.commit()
    return {"message": "Password changed successfully."}
