import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_role
from app.geo import haversine_km
from app.kyc_rules import validate_number
from app.models import Driver, Transfer, User, Vehicle
from app.otp import normalize_phone
from app.schemas import (
    DriverMeOut, DriverProfileIn, LocationIn, OnlineIn, OtpIn, TransferForDriver, VehicleIn,
)

router = APIRouter(prefix="/api/driver", tags=["driver"])
ACTIVE = ("accepted", "arrived", "in_trip")
COMMISSION = 0.80  # driver keeps 80% of the fare


def get_driver(db: Session, user: User) -> Driver:
    driver = db.scalar(select(Driver).options(joinedload(Driver.vehicle)).where(Driver.user_id == user.id))
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    return driver


def _ride(db: Session, driver: Driver, transfer_id: int) -> Transfer:
    stmt = select(Transfer).options(joinedload(Transfer.user)).where(Transfer.id == transfer_id)
    transfer = db.scalar(stmt)
    if not transfer or transfer.driver_id != driver.id:
        raise HTTPException(status_code=404, detail="Ride not found")
    return transfer


@router.get("/me", response_model=DriverMeOut)
def me(db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    return get_driver(db, user)


@router.put("/profile", response_model=DriverMeOut)
def update_profile(data: DriverProfileIn, db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    values = data.model_dump(exclude_unset=True)
    # Only the last 4 characters of ID numbers are stored (data minimisation).
    for field, doc_type, attr in (
        ("aadhaar", "aadhaar", "aadhaar_last4"), ("pan", "pan", "pan_last4"), ("licence", "driving_licence", "licence_last4"),
    ):
        number = values.pop(field, None)
        if number:
            try:
                setattr(driver, attr, validate_number(doc_type, number)[-4:])
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))
    if values.get("phone"):
        values["phone"] = normalize_phone(values["phone"])
    for key, value in values.items():
        if value is not None:
            setattr(driver, key, value)
    if values.get("full_name"):
        user.name = values["full_name"]
    db.commit()
    db.refresh(driver)
    return driver


@router.put("/vehicle", response_model=DriverMeOut)
def update_vehicle(data: VehicleIn, db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    values = data.model_dump()
    values["plate_number"] = values["plate_number"].upper().strip()
    if driver.vehicle:
        for key, value in values.items():
            setattr(driver.vehicle, key, value)
    else:
        driver.vehicle = Vehicle(**values)
    db.commit()
    db.refresh(driver)
    return driver


@router.post("/online", response_model=DriverMeOut)
def set_online(data: OnlineIn, db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    if data.online:
        if driver.kyc_status != "approved":
            raise HTTPException(status_code=403, detail="Your documents are not approved yet")
        if not driver.vehicle:
            raise HTTPException(status_code=400, detail="Add your vehicle details first")
    driver.is_online = data.online
    db.commit()
    db.refresh(driver)
    return driver


@router.post("/location", response_model=DriverMeOut)
def update_location(data: LocationIn, db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    driver.lat, driver.lng, driver.last_seen = data.lat, data.lng, datetime.now(timezone.utc)
    db.commit()
    db.refresh(driver)
    return driver


@router.get("/requests", response_model=list[TransferForDriver])
def open_requests(db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    if not (driver.is_online and driver.kyc_status == "approved" and driver.vehicle):
        return []
    stmt = (
        select(Transfer).options(joinedload(Transfer.user))
        .where(Transfer.status == "requested", Transfer.vehicle_category == driver.vehicle.category)
        .order_by(Transfer.pickup_time)
    )
    out = []
    for t in db.scalars(stmt).all():
        item = TransferForDriver.model_validate(t)
        if driver.lat is not None:
            item.pickup_distance_km = round(haversine_km(driver.lat, driver.lng, t.pickup_lat, t.pickup_lng), 1)
        out.append(item)
    return out


@router.get("/current", response_model=TransferForDriver | None)
def current_ride(db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    stmt = (
        select(Transfer).options(joinedload(Transfer.user))
        .where(Transfer.driver_id == driver.id, Transfer.status.in_(ACTIVE))
    )
    return db.scalar(stmt)


@router.post("/transfers/{transfer_id}/accept", response_model=TransferForDriver)
def accept(transfer_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    if not driver.is_online:
        raise HTTPException(status_code=403, detail="Go online to accept rides")
    if db.scalar(select(Transfer.id).where(Transfer.driver_id == driver.id, Transfer.status.in_(ACTIVE))):
        raise HTTPException(status_code=409, detail="Finish your current ride first")
    # Row lock: if two drivers tap Accept together, only the first one wins.
    transfer = db.scalar(select(Transfer).where(Transfer.id == transfer_id).with_for_update())
    if not transfer or transfer.status != "requested":
        raise HTTPException(status_code=409, detail="This ride was already taken or cancelled")
    transfer.driver_id, transfer.status = driver.id, "accepted"
    db.commit()
    return TransferForDriver.model_validate(_ride(db, driver, transfer_id))


@router.post("/transfers/{transfer_id}/arrived", response_model=TransferForDriver)
def arrived(transfer_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    transfer = _ride(db, driver, transfer_id)
    if transfer.status != "accepted":
        raise HTTPException(status_code=400, detail="Ride is not in the accepted state")
    transfer.status = "arrived"
    db.commit()
    return TransferForDriver.model_validate(transfer)


@router.post("/transfers/{transfer_id}/start", response_model=TransferForDriver)
def start(transfer_id: int, data: OtpIn, db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    transfer = _ride(db, driver, transfer_id)
    if transfer.status != "arrived":
        raise HTTPException(status_code=400, detail="Mark the ride as arrived first")
    if not hmac.compare_digest(transfer.ride_otp, data.otp):
        raise HTTPException(status_code=400, detail="Incorrect ride OTP")
    transfer.status, transfer.started_at = "in_trip", datetime.now(timezone.utc)
    db.commit()
    return TransferForDriver.model_validate(transfer)


@router.post("/transfers/{transfer_id}/complete", response_model=TransferForDriver)
def complete(transfer_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    transfer = _ride(db, driver, transfer_id)
    if transfer.status != "in_trip":
        raise HTTPException(status_code=400, detail="Ride has not started")
    transfer.status, transfer.completed_at = "completed", datetime.now(timezone.utc)
    driver.total_trips += 1
    db.commit()
    return TransferForDriver.model_validate(transfer)


@router.get("/trips")
def trip_history(db: Session = Depends(get_db), user: User = Depends(require_role("driver"))):
    driver = get_driver(db, user)
    rows = db.scalars(
        select(Transfer).options(joinedload(Transfer.user))
        .where(Transfer.driver_id == driver.id, Transfer.status == "completed")
        .order_by(Transfer.completed_at.desc())
    ).all()
    total = sum(float(t.fare) for t in rows)
    return {
        "count": len(rows),
        "earnings": round(total * COMMISSION),
        "trips": [TransferForDriver.model_validate(t).model_dump(mode="json") for t in rows],
    }
