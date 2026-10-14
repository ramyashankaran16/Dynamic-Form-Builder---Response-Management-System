import math
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


def paginate(db: Session, stmt: Select, page: int, size: int) -> tuple[list[Any], int]:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    items = db.scalars(stmt.offset((page - 1) * size).limit(size)).unique().all()
    return list(items), total


def page_meta(total: int, page: int, size: int) -> dict[str, int]:
    return {"total": total, "page": page, "size": size, "pages": math.ceil(total / size) if size else 0}
