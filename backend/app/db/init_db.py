"""Seed roles and the first admin user. Safe to run repeatedly.

Usage:  python -m app.db.init_db
"""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import RoleName
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Role, User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("init_db")

ROLES = {
    RoleName.ADMIN: "Full access: all forms, responses, users, analytics and logs",
    RoleName.USER: "Create and manage own forms and their responses",
}


def seed(db: Session) -> None:
    for name, description in ROLES.items():
        if not db.scalar(select(Role).where(Role.name == name)):
            db.add(Role(name=name, description=description))
            logger.info("Created role %s", name)
    db.flush()

    email = settings.FIRST_ADMIN_EMAIL.lower()
    if not db.scalar(select(User).where(User.email == email)):
        admin_role = db.scalar(select(Role).where(Role.name == RoleName.ADMIN))
        db.add(User(full_name=settings.FIRST_ADMIN_NAME, email=email,
                    hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD), role=admin_role))
        logger.info("Created admin user %s", email)
    db.commit()


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
    logger.info("Seeding complete.")
