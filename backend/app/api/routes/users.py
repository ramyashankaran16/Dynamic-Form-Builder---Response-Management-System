from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import Pagination, get_db, require_admin
from app.core.constants import Action, EntityType, RoleName
from app.models import Role, User
from app.schemas.common import MessageResponse, Page
from app.schemas.user import AdminUserUpdate, RoleOut, UserOut
from app.services.activity_service import log_activity
from app.utils.pagination import page_meta, paginate

router = APIRouter(prefix="/users", tags=["Users (Admin)"])


@router.get("/roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.scalars(select(Role).order_by(Role.id)).all()


@router.get("", response_model=Page[UserOut])
def list_users(
    pagination: Pagination = Depends(),
    search: str | None = Query(None, description="Name or email"),
    role: RoleName | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(User).order_by(User.created_at.desc(), User.id.desc())
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(term), User.email.ilike(term)))
    if role:
        stmt = stmt.join(Role).where(Role.name == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
    items, total = paginate(db, stmt, pagination.page, pagination.size)
    return {"items": items, **page_meta(total, pagination.page, pagination.size)}


def _get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    return user


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return _get_user(db, user_id)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: AdminUserUpdate, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Change a user's name, role or active status."""
    user = _get_user(db, user_id)
    if user.id == admin.id and (payload.is_active is False or (payload.role and payload.role != RoleName.ADMIN)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot deactivate or demote your own account.")
    old = {"full_name": user.full_name, "role": user.role_name, "is_active": user.is_active}
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.role is not None:
        user.role = db.scalar(select(Role).where(Role.name == payload.role))
    if payload.is_active is not None:
        user.is_active = payload.is_active
    new = {"full_name": user.full_name, "role": user.role_name, "is_active": user.is_active}
    changed = {k: new[k] for k in new if new[k] != old[k]}
    if changed:
        log_activity(db, action=Action.USER_UPDATED, user=admin, entity_type=EntityType.USER, entity_id=user.id,
                     description=f"User {user.email} updated", old_values={k: old[k] for k in changed},
                     new_values=changed, request=request)
    db.commit()
    return user


@router.delete("/{user_id}", response_model=MessageResponse)
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Permanently deletes the user **and their forms**. Prefer deactivating (`is_active=false`)."""
    user = _get_user(db, user_id)
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete your own account.")
    log_activity(db, action=Action.USER_DELETED, user=admin, entity_type=EntityType.USER, entity_id=user.id,
                 description=f"User {user.email} deleted", old_values={"email": user.email, "full_name": user.full_name},
                 request=request)
    db.delete(user)
    db.commit()
    return {"message": "User deleted."}
