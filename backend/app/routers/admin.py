from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_role
from app.models import Booking, Document, Driver, Stay, Transfer, User

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])


def _sum(db: Session, column, status_col) -> float:
    return float(db.scalar(select(func.coalesce(func.sum(column), 0)).where(status_col != "cancelled")) or 0)


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    count = lambda model, *where: db.scalar(select(func.count()).select_from(model).where(*where)) or 0
    return {
        "customers": count(User, User.role == "customer"),
        "drivers": count(Driver),
        "drivers_online": count(Driver, Driver.is_online.is_(True)),
        "drivers_pending_kyc": count(Driver, Driver.kyc_status == "pending"),
        "documents_pending": count(Document, Document.status == "pending"),
        "trip_bookings": count(Booking, Booking.status != "cancelled"),
        "hotel_stays": count(Stay, Stay.status != "cancelled"),
        "transfers": count(Transfer, Transfer.status != "cancelled"),
        "revenue": {
            "trips": _sum(db, Booking.total_price, Booking.status),
            "stays": _sum(db, Stay.total_price, Stay.status),
            "transfers": _sum(db, Transfer.fare, Transfer.status),
        },
    }


@router.get("/users")
def users(db: Session = Depends(get_db)):
    rows = db.scalars(select(User).order_by(User.id.desc()).limit(200)).all()
    return [
        {"id": u.id, "name": u.name, "email": u.email, "phone": u.phone, "role": u.role, "created_at": u.created_at}
        for u in rows
    ]


@router.get("/drivers")
def drivers(db: Session = Depends(get_db)):
    rows = db.scalars(select(Driver).options(joinedload(Driver.vehicle), joinedload(Driver.user))).all()
    docs = {}
    for d in db.scalars(select(Document)).all():
        docs.setdefault(d.user_id, []).append({"type": d.doc_type, "status": d.status})
    return [
        {
            "id": d.id, "name": d.full_name, "email": d.user.email, "phone": d.phone, "city": d.city,
            "aadhaar_last4": d.aadhaar_last4, "pan_last4": d.pan_last4, "licence_last4": d.licence_last4,
            "licence_expiry": d.licence_expiry, "kyc_status": d.kyc_status, "is_online": d.is_online,
            "rating": d.rating, "total_trips": d.total_trips,
            "vehicle": (
                f"{d.vehicle.make_model} ({d.vehicle.category}) {d.vehicle.plate_number}" if d.vehicle else None
            ),
            "documents": docs.get(d.user_id, []),
        }
        for d in rows
    ]


@router.get("/activity")
def activity(db: Session = Depends(get_db)):
    transfers = db.scalars(
        select(Transfer).options(joinedload(Transfer.user), joinedload(Transfer.driver))
        .order_by(Transfer.created_at.desc()).limit(30)
    ).all()
    stays = db.scalars(
        select(Stay).options(joinedload(Stay.user), joinedload(Stay.hotel)).order_by(Stay.created_at.desc()).limit(30)
    ).all()
    trips = db.scalars(
        select(Booking).options(joinedload(Booking.user), joinedload(Booking.package))
        .order_by(Booking.created_at.desc()).limit(30)
    ).all()
    return {
        "transfers": [
            {"id": t.id, "customer": t.user.name, "driver": t.driver.full_name if t.driver else None,
             "route": f"{t.pickup_name} to {t.drop_name}", "fare": float(t.fare), "status": t.status}
            for t in transfers
        ],
        "stays": [
            {"id": s.id, "customer": s.user.name, "hotel": s.hotel.name, "nights": s.nights,
             "total": float(s.total_price), "status": s.status}
            for s in stays
        ],
        "trips": [
            {"id": b.id, "customer": b.user.name, "package": b.package.title, "total": float(b.total_price),
             "status": b.status}
            for b in trips
        ],
    }
