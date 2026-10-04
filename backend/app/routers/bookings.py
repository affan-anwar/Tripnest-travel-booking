import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_role
from app.kyc_rules import check_kyc
from app.models import Booking, Document, Package, User
from app.routers.offers import evaluate_offer
from app.schemas import BookingCreate, BookingOut

router = APIRouter(prefix="/api/bookings", tags=["trips"])
customer_only = require_role("customer")


@router.post("", response_model=BookingOut, status_code=201)
def create_booking(data: BookingCreate, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    # Lock the package row so two users cannot take the last seats at the same time.
    package = db.scalar(select(Package).where(Package.id == data.package_id).with_for_update())
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    docs = db.scalars(select(Document).where(Document.user_id == user.id)).all()
    kyc = check_kyc(docs, package)
    if not kyc["submitted"]:
        raise HTTPException(status_code=400, detail="Verification required: " + ", ".join(kyc["missing"]))
    if package.seats < data.travelers:
        raise HTTPException(status_code=400, detail=f"Only {package.seats} seats left")

    subtotal = package.price * data.travelers
    discount, code = Decimal("0.00"), None
    if data.offer_code and data.offer_code.strip():
        offer, discount = evaluate_offer(db, data.offer_code, subtotal, "trip", package.is_international)
        code = offer.code

    package.seats -= data.travelers
    booking = Booking(
        user_id=user.id, package_id=package.id, travelers=data.travelers, travel_date=data.travel_date,
        passengers_json=json.dumps([p.model_dump() for p in data.passengers]),
        subtotal=subtotal, discount=discount, offer_code=code, total_price=subtotal - discount,
        status="confirmed" if kyc["approved"] else "pending_verification",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/mine", response_model=list[BookingOut])
def my_bookings(db: Session = Depends(get_db), user: User = Depends(customer_only)):
    stmt = (
        select(Booking).options(joinedload(Booking.package))
        .where(Booking.user_id == user.id).order_by(Booking.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(booking_id: int, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    booking = db.get(Booking, booking_id)
    if not booking or booking.user_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking already cancelled")
    package = db.scalar(select(Package).where(Package.id == booking.package_id).with_for_update())
    package.seats += booking.travelers
    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)
    return booking
