import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app import config
from app.database import get_db
from app.deps import get_current_user, require_role
from app.geo import VEHICLES, fare_for, haversine_km, road_distance_km
from app.models import Driver, Place, Transfer, User, Vehicle
from app.schemas import PlaceOut, QuoteIn, QuoteOut, TransferCreate, TransferOut

router = APIRouter(prefix="/api/transfers", tags=["transfers"])
customer_only = require_role("customer")


def load_transfer(db: Session, transfer_id: int) -> Transfer | None:
    return db.scalar(
        select(Transfer).options(joinedload(Transfer.driver).joinedload(Driver.vehicle))
        .where(Transfer.id == transfer_id)
    )


@router.get("/places", response_model=list[PlaceOut])
def list_places(kind: str | None = None, q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Place)
    if kind:
        stmt = stmt.where(Place.kind == kind)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Place.name.ilike(like), Place.city.ilike(like), Place.code.ilike(like)))
    return db.scalars(stmt.order_by(Place.kind, Place.city)).all()


@router.post("/quote", response_model=QuoteOut)
def quote(data: QuoteIn):
    km = road_distance_km(data.pickup_lat, data.pickup_lng, data.drop_lat, data.drop_lng)
    options = [
        {"category": key, "label": v["label"], "seats": v["seats"], "fare": fare_for(key, km)}
        for key, v in VEHICLES.items()
    ]
    return QuoteOut(distance_km=km, options=options)


@router.post("", response_model=TransferOut, status_code=201)
def create_transfer(data: TransferCreate, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    km = road_distance_km(data.pickup_lat, data.pickup_lng, data.drop_lat, data.drop_lng)
    if km < 0.2:
        raise HTTPException(status_code=400, detail="Pickup and drop are the same place")
    vehicle = VEHICLES[data.vehicle_category]
    if data.passengers > vehicle["seats"]:
        raise HTTPException(status_code=400, detail=f"{vehicle['label']} seats {vehicle['seats']} passengers at most")
    transfer = Transfer(
        user_id=user.id, pickup_name=data.pickup_name, pickup_lat=data.pickup_lat, pickup_lng=data.pickup_lng,
        drop_name=data.drop_name, drop_lat=data.drop_lat, drop_lng=data.drop_lng, pickup_time=data.pickup_time,
        passengers=data.passengers, luggage=data.luggage, vehicle_category=data.vehicle_category,
        flight_or_train=data.flight_or_train, notes=data.notes, distance_km=km,
        fare=fare_for(data.vehicle_category, km), ride_otp=f"{secrets.randbelow(10000):04d}",
    )
    db.add(transfer)
    db.commit()
    return load_transfer(db, transfer.id)


@router.get("/mine", response_model=list[TransferOut])
def my_transfers(db: Session = Depends(get_db), user: User = Depends(customer_only)):
    stmt = (
        select(Transfer).options(joinedload(Transfer.driver).joinedload(Driver.vehicle))
        .where(Transfer.user_id == user.id).order_by(Transfer.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.get("/{transfer_id}", response_model=TransferOut)
def get_transfer(transfer_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Polled by the tracking page every few seconds: returns status and the driver's live location."""
    transfer = load_transfer(db, transfer_id)
    if not transfer or (transfer.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Ride not found")
    return transfer


@router.post("/{transfer_id}/cancel", response_model=TransferOut)
def cancel_transfer(transfer_id: int, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    transfer = load_transfer(db, transfer_id)
    if not transfer or transfer.user_id != user.id:
        raise HTTPException(status_code=404, detail="Ride not found")
    if transfer.status not in ("requested", "accepted", "arrived"):
        raise HTTPException(status_code=400, detail="This ride can no longer be cancelled")
    transfer.status = "cancelled"
    db.commit()
    return load_transfer(db, transfer_id)


def _step(driver: Driver, lat: float, lng: float, fraction: float) -> float:
    """Moves the driver a fraction of the way towards a point; returns the remaining distance in km."""
    driver.lat = driver.lat + (lat - driver.lat) * fraction
    driver.lng = driver.lng + (lng - driver.lng) * fraction
    driver.last_seen = datetime.now(timezone.utc)
    return haversine_km(driver.lat, driver.lng, lat, lng)


@router.post("/{transfer_id}/demo-step", response_model=TransferOut)
def demo_step(transfer_id: int, db: Session = Depends(get_db), user: User = Depends(customer_only)):
    """DEMO ONLY: simulates a driver so live tracking can be shown without a second login."""
    if not config.DEMO_MODE:
        raise HTTPException(status_code=403, detail="Demo mode is disabled")
    t = load_transfer(db, transfer_id)
    if not t or t.user_id != user.id:
        raise HTTPException(status_code=404, detail="Ride not found")
    if t.status in ("completed", "cancelled"):
        return t

    if t.status == "requested":
        candidates = db.scalars(
            select(Driver).join(Vehicle).where(
                Driver.is_online.is_(True), Driver.kyc_status == "approved",
                Driver.lat.is_not(None), Vehicle.category == t.vehicle_category,
            )
        ).all()
        if not candidates:
            raise HTTPException(status_code=409, detail="No demo driver is online for this vehicle type")
        driver = min(candidates, key=lambda d: haversine_km(d.lat, d.lng, t.pickup_lat, t.pickup_lng))
        t.driver_id, t.status = driver.id, "accepted"
    else:
        driver = t.driver
        if driver.lat is None:
            driver.lat, driver.lng = t.pickup_lat + 0.05, t.pickup_lng + 0.05
        if t.status == "accepted":
            if _step(driver, t.pickup_lat, t.pickup_lng, 0.5) < 0.3:
                driver.lat, driver.lng, t.status = t.pickup_lat, t.pickup_lng, "arrived"
        elif t.status == "arrived":
            t.status, t.started_at = "in_trip", datetime.now(timezone.utc)
        elif t.status == "in_trip":
            if _step(driver, t.drop_lat, t.drop_lng, 0.4) < 0.3:
                driver.lat, driver.lng = t.drop_lat, t.drop_lng
                t.status, t.completed_at = "completed", datetime.now(timezone.utc)
                driver.total_trips += 1
    db.commit()
    return load_transfer(db, transfer_id)
