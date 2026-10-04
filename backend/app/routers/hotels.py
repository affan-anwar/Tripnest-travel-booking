import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.deps import require_role
from app.models import Hotel, RoomType, Stay, User
from app.routers.offers import evaluate_offer
from app.schemas import HotelOut, StayCreate, StayOut

router = APIRouter(prefix="/api/hotels", tags=["hotels"])
customer_only = require_role("customer")

# Paid extras a guest can add to a stay (flat price per stay, INR).
ADDONS = {
    "airport_pickup": ("Airport pickup and drop", 2500),
    "breakfast": ("Daily breakfast buffet", 1800),
    "spa": ("Signature spa session", 3500),
    "late_checkout": ("Late checkout until 4 PM", 1500),
    "extra_bed": ("Extra bed", 2000),
    "candle_dinner": ("Candlelight dinner", 4500),
}


@router.get("/addons")
def list_addons():
    return [{"code": k, "label": v[0], "price": v[1]} for k, v in ADDONS.items()]


@router.get("", response_model=list[HotelOut])
def list_hotels(
    q: str | None = None,
    stars: int | None = None,
    max_price: float | None = None,
    amenity: str | None = None,
    sort: str | None = None,
    db: Session = Depends(get_db),
):
    # selectinload loads all rooms in ONE extra query (avoids the N+1 problem).
    stmt = select(Hotel).options(selectinload(Hotel.rooms))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Hotel.name.ilike(like), Hotel.city.ilike(like), Hotel.country.ilike(like)))
    if stars:
        stmt = stmt.where(Hotel.star_rating >= stars)
    if amenity:
        stmt = stmt.where(Hotel.amenities.ilike(f"%{amenity}%"))
    hotels = db.scalars(stmt.order_by(Hotel.id)).all()
    if max_price is not None:
        hotels = [h for h in hotels if h.from_price is not None and h.from_price <= max_price]
    if sort == "price_asc":
        hotels.sort(key=lambda h: h.from_price or 0)
    elif sort == "price_desc":
        hotels.sort(key=lambda h: h.from_price or 0, reverse=True)
    elif sort == "rating":
        hotels.sort(key=lambda h: h.rating, reverse=True)
    return hotels


@router.get("/stays/mine", response_model=list[StayOut])
def my_stays(db: Session = Depends(get_db), user: User = Depends(customer_only)):
    stmt = (
        select(Stay).options(joinedload(Stay.hotel), joinedload(Stay.room_type))
        .where(Stay.user_id == user.id).order_by(Stay.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.post("/stays", response_model=StayOut, status_code=201)
def book_stay(data: StayCreate, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    # Lock the room type so two guests cannot take the last room for the same dates.
    room = db.scalar(
        select(RoomType).where(RoomType.id == data.room_type_id, RoomType.hotel_id == data.hotel_id).with_for_update()
    )
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if data.guests > room.max_guests * data.rooms:
        raise HTTPException(status_code=400, detail=f"This room fits {room.max_guests} guests per room")
    bad = [a for a in data.addons if a not in ADDONS]
    if bad:
        raise HTTPException(status_code=400, detail="Unknown add-on: " + ", ".join(bad))

    # Overlap rule: existing.check_in < new.check_out AND existing.check_out > new.check_in
    booked = db.scalar(
        select(func.coalesce(func.sum(Stay.rooms), 0)).where(
            Stay.room_type_id == room.id, Stay.status != "cancelled",
            Stay.check_in < data.check_out, Stay.check_out > data.check_in,
        )
    )
    if booked + data.rooms > room.rooms_available:
        raise HTTPException(status_code=409, detail="Not enough rooms available for these dates")

    nights = (data.check_out - data.check_in).days
    subtotal = room.price_per_night * data.rooms * nights
    addons = sorted(set(data.addons))
    addons_total = Decimal(sum(ADDONS[a][1] for a in addons))
    base = subtotal + addons_total
    discount, code = Decimal("0.00"), None
    if data.offer_code and data.offer_code.strip():
        offer, discount = evaluate_offer(db, data.offer_code, base, "stay")
        code = offer.code

    stay = Stay(
        user_id=user.id, hotel_id=data.hotel_id, room_type_id=room.id, check_in=data.check_in,
        check_out=data.check_out, nights=nights, rooms=data.rooms, guests=data.guests,
        addons=",".join(addons), addons_total=addons_total,
        guest_json=json.dumps([g.model_dump() for g in data.guest_details]),
        special_requests=data.special_requests, subtotal=subtotal, discount=discount,
        offer_code=code, total_price=base - discount,
    )
    db.add(stay)
    db.commit()
    return db.scalar(
        select(Stay).options(joinedload(Stay.hotel), joinedload(Stay.room_type)).where(Stay.id == stay.id)
    )


@router.post("/stays/{stay_id}/cancel", response_model=StayOut)
def cancel_stay(stay_id: int, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    stay = db.scalar(
        select(Stay).options(joinedload(Stay.hotel), joinedload(Stay.room_type)).where(Stay.id == stay_id)
    )
    if not stay or stay.user_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if stay.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking already cancelled")
    stay.status = "cancelled"
    db.commit()
    db.refresh(stay)
    return stay


@router.get("/{hotel_id}", response_model=HotelOut)
def get_hotel(hotel_id: int, db: Session = Depends(get_db)):
    hotel = db.scalar(select(Hotel).options(selectinload(Hotel.rooms)).where(Hotel.id == hotel_id))
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return hotel
