from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_role
from app.models import Package
from app.schemas import PackageIn, PackageOut

router = APIRouter(prefix="/api/packages", tags=["trips"])

SORTS = {"price_asc": Package.price.asc(), "price_desc": Package.price.desc(), "days": Package.duration_days.asc()}


@router.get("", response_model=list[PackageOut])
def list_packages(
    q: str | None = None,
    max_price: float | None = None,
    region: str | None = None,
    continent: str | None = None,
    category: str | None = None,
    sort: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Package)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Package.title.ilike(like), Package.destination.ilike(like), Package.country.ilike(like)))
    if max_price is not None:
        stmt = stmt.where(Package.price <= max_price)
    if region == "domestic":
        stmt = stmt.where(Package.is_international.is_(False))
    elif region == "international":
        stmt = stmt.where(Package.is_international.is_(True))
    if continent:
        stmt = stmt.where(Package.continent == continent)
    if category:
        stmt = stmt.where(Package.category == category)
    return db.scalars(stmt.order_by(SORTS.get(sort, Package.id))).all()


@router.get("/{package_id}", response_model=PackageOut)
def get_package(package_id: int, db: Session = Depends(get_db)):
    package = db.get(Package, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    return package


@router.post("", response_model=PackageOut, status_code=201, dependencies=[Depends(require_role("admin"))])
def create_package(data: PackageIn, db: Session = Depends(get_db)):
    package = Package(**data.model_dump())
    db.add(package)
    db.commit()
    db.refresh(package)
    return package
