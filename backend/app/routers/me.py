from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_role
from app.kyc_rules import validate_number
from app.models import Passenger, User
from app.otp import normalize_phone
from app.schemas import PassengerIn, PassengerOut, ProfileIn, SettingsIn, UserOut

router = APIRouter(prefix="/api/me", tags=["account"])


@router.get("/profile", response_model=UserOut)
def get_profile(user: User = Depends(get_current_user)):
    return user


@router.put("/profile", response_model=UserOut)
def update_profile(data: ProfileIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    values = data.model_dump(exclude_unset=True)
    if "phone" in values:
        if values["phone"]:
            phone = normalize_phone(values["phone"])
            if db.scalar(select(User).where(User.phone == phone, User.id != user.id)):
                raise HTTPException(status_code=409, detail="This mobile number is already in use")
            values["phone"] = phone
        else:
            values["phone"] = None
    for key, value in values.items():
        if value is None and key not in ("dob", "phone"):
            continue
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.put("/settings", response_model=UserOut)
def update_settings(data: SettingsIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(user, key, value.upper() if key == "currency" else value)
    db.commit()
    db.refresh(user)
    return user


@router.get("/passengers", response_model=list[PassengerOut])
def list_passengers(db: Session = Depends(get_db), user: User = Depends(require_role("customer"))):
    return db.scalars(select(Passenger).where(Passenger.user_id == user.id).order_by(Passenger.id)).all()


@router.post("/passengers", response_model=PassengerOut, status_code=201)
def add_passenger(data: PassengerIn, db: Session = Depends(get_db), user: User = Depends(require_role("customer"))):
    last4 = None
    if data.id_type:
        try:
            last4 = validate_number(data.id_type, data.id_number)[-4:]
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    passenger = Passenger(
        user_id=user.id, full_name=data.full_name, age=data.age, gender=data.gender,
        nationality=data.nationality, id_type=data.id_type, id_last4=last4,
    )
    db.add(passenger)
    db.commit()
    db.refresh(passenger)
    return passenger


@router.delete("/passengers/{passenger_id}", status_code=204)
def delete_passenger(passenger_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("customer"))):
    passenger = db.get(Passenger, passenger_id)
    if not passenger or passenger.user_id != user.id:
        raise HTTPException(status_code=404, detail="Passenger not found")
    db.delete(passenger)
    db.commit()
