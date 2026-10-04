from datetime import date, datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Category = Literal["hatchback", "sedan", "suv", "luxury", "tempo"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def _to_list(v):
    if isinstance(v, str):
        sep = "|" if "|" in v else ","
        return [x.strip() for x in v.split(sep) if x.strip()]
    return v


# ---------- auth / account ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=6, max_length=72)
    role: Literal["customer", "driver", "admin"] = "customer"
    admin_code: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=255)


class ForgotIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ResetIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=6, max_length=72)


class LoginIn(BaseModel):
    email: str
    password: str


class OtpSendIn(BaseModel):
    phone: str = Field(min_length=10, max_length=20)


class OtpVerifyIn(BaseModel):
    phone: str = Field(min_length=10, max_length=20)
    code: str = Field(min_length=6, max_length=6)
    name: Optional[str] = Field(default=None, max_length=100)


class UserOut(ORM):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    address: str = ""
    nationality: str = ""
    dob: Optional[date] = None
    emergency_name: str = ""
    emergency_phone: str = ""
    theme: str = "system"
    currency: str = "INR"
    notify_email: bool = True
    notify_sms: bool = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=255)
    nationality: Optional[str] = Field(default=None, max_length=60)
    dob: Optional[date] = None
    emergency_name: Optional[str] = Field(default=None, max_length=100)
    emergency_phone: Optional[str] = Field(default=None, max_length=20)


class SettingsIn(BaseModel):
    theme: Optional[Literal["light", "dark", "system"]] = None
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    notify_email: Optional[bool] = None
    notify_sms: Optional[bool] = None


class PassengerIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=0, le=120)
    gender: Literal["male", "female", "other"] = "male"
    nationality: str = Field(default="", max_length=60)
    id_type: Literal["", "aadhaar", "pan", "passport", "driving_licence"] = ""
    id_number: str = ""


class PassengerOut(ORM):
    id: int
    full_name: str
    age: int
    gender: str
    nationality: str
    id_type: str
    id_last4: Optional[str] = None


class PassengerLine(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=0, le=120)
    gender: Literal["male", "female", "other"] = "male"


# ---------- trips ----------
class PackageIn(BaseModel):
    title: str
    destination: str
    country: str = "India"
    continent: str = "Asia"
    category: str = "City"
    is_international: bool = False
    currency: str = "INR"
    visa_required: bool = False
    latitude: float = 0.0
    longitude: float = 0.0
    description: str
    price: float = Field(gt=0)
    duration_days: int = Field(gt=0)
    seats: int = Field(ge=0, default=20)
    image_url: str = ""


class PackageOut(PackageIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class OfferOut(ORM):
    id: int
    code: str
    title: str
    description: str
    discount_percent: int
    max_discount: float
    min_amount: float
    applies_to: str
    valid_until: Optional[date] = None


class OfferCheckIn(BaseModel):
    code: str
    kind: Literal["trip", "stay"] = "trip"
    amount: float = Field(gt=0)
    international: bool = False


class OfferCheckOut(BaseModel):
    code: str
    discount: float
    final_price: float
    message: str


class BookingCreate(BaseModel):
    package_id: int
    travelers: int = Field(ge=1, le=10)
    travel_date: date
    offer_code: Optional[str] = None
    passengers: list[PassengerLine] = []

    @field_validator("travel_date")
    @classmethod
    def must_be_future(cls, v: date) -> date:
        if v <= date.today():
            raise ValueError("Travel date must be in the future")
        return v

    @model_validator(mode="after")
    def passenger_count(self):
        if self.passengers and len(self.passengers) != self.travelers:
            raise ValueError("Enter details for every traveller")
        return self


class BookingOut(ORM):
    id: int
    travelers: int
    travel_date: date
    passengers: list[dict] = []
    subtotal: float
    discount: float
    offer_code: Optional[str] = None
    total_price: float
    status: str
    payment_status: str
    package: PackageOut


# ---------- hotels ----------
class RoomOut(ORM):
    id: int
    hotel_id: int
    name: str
    bed_type: str
    size_sqm: int
    max_guests: int
    price_per_night: float
    breakfast_included: bool
    refundable: bool
    rooms_available: int
    image_url: str
    features: list[str] = []

    @field_validator("features", mode="before")
    @classmethod
    def split_lists(cls, v):
        return _to_list(v)


class HotelOut(ORM):
    id: int
    name: str
    city: str
    country: str
    address: str
    star_rating: int
    description: str
    latitude: float
    longitude: float
    rating: float
    reviews_count: int
    amenities: list[str] = []
    images: list[str] = []
    check_in_time: str
    check_out_time: str
    cancellation_policy: str
    nearest_airport: str
    airport_distance_km: float
    from_price: Optional[float] = None
    rooms: list[RoomOut] = []

    @field_validator("amenities", "images", mode="before")
    @classmethod
    def split_lists(cls, v):
        return _to_list(v)


class HotelBrief(ORM):
    id: int
    name: str
    city: str
    country: str
    star_rating: int
    images: list[str] = []

    @field_validator("images", mode="before")
    @classmethod
    def split_lists(cls, v):
        return _to_list(v)


class RoomBrief(ORM):
    id: int
    name: str


class StayCreate(BaseModel):
    hotel_id: int
    room_type_id: int
    check_in: date
    check_out: date
    rooms: int = Field(ge=1, le=5, default=1)
    guests: int = Field(ge=1, le=20, default=1)
    addons: list[str] = []
    special_requests: str = Field(default="", max_length=500)
    guest_details: list[PassengerLine] = []
    offer_code: Optional[str] = None

    @model_validator(mode="after")
    def check_dates(self):
        if self.check_in < date.today():
            raise ValueError("Check-in date cannot be in the past")
        if self.check_out <= self.check_in:
            raise ValueError("Check-out must be after check-in")
        return self


class StayOut(ORM):
    id: int
    hotel: HotelBrief
    room_type: RoomBrief
    check_in: date
    check_out: date
    nights: int
    rooms: int
    guests: int
    addons: list[str] = []
    addons_total: float
    guest_details: list[dict] = []
    special_requests: str
    subtotal: float
    discount: float
    offer_code: Optional[str] = None
    total_price: float
    status: str
    payment_status: str

    @field_validator("addons", mode="before")
    @classmethod
    def split_lists(cls, v):
        return _to_list(v)


# ---------- transfers / drivers ----------
class PlaceOut(ORM):
    id: int
    kind: str
    name: str
    code: str
    city: str
    country: str
    lat: float
    lng: float


class QuoteIn(BaseModel):
    pickup_lat: float
    pickup_lng: float
    drop_lat: float
    drop_lng: float


class QuoteOption(BaseModel):
    category: str
    label: str
    seats: int
    fare: int


class QuoteOut(BaseModel):
    distance_km: float
    options: list[QuoteOption]


class TransferCreate(BaseModel):
    pickup_name: str = Field(min_length=2, max_length=150)
    pickup_lat: float
    pickup_lng: float
    drop_name: str = Field(min_length=2, max_length=150)
    drop_lat: float
    drop_lng: float
    pickup_time: datetime
    passengers: int = Field(ge=1, le=12, default=1)
    luggage: int = Field(ge=0, le=20, default=0)
    vehicle_category: Category
    flight_or_train: str = Field(default="", max_length=30)
    notes: str = Field(default="", max_length=255)

    @field_validator("pickup_time")
    @classmethod
    def with_timezone(cls, v: datetime) -> datetime:
        return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v


class VehicleIn(BaseModel):
    category: Category
    make_model: str = Field(min_length=2, max_length=80)
    plate_number: str = Field(min_length=4, max_length=20)
    color: str = Field(default="White", max_length=30)
    seats: int = Field(ge=2, le=20, default=4)
    ac: bool = True


class VehicleOut(ORM):
    id: int
    category: str
    make_model: str
    plate_number: str
    color: str
    seats: int
    ac: bool


class DriverPublic(ORM):
    id: int
    full_name: str
    phone: str
    rating: float
    total_trips: int
    lat: Optional[float] = None
    lng: Optional[float] = None
    last_seen: Optional[datetime] = None
    vehicle: Optional[VehicleOut] = None


class TransferBase(ORM):
    id: int
    pickup_name: str
    pickup_lat: float
    pickup_lng: float
    drop_name: str
    drop_lat: float
    drop_lng: float
    pickup_time: datetime
    passengers: int
    luggage: int
    vehicle_category: str
    flight_or_train: str
    notes: str
    distance_km: float
    fare: float
    status: str
    payment_status: str
    created_at: datetime


class TransferOut(TransferBase):
    ride_otp: Optional[str] = None
    driver: Optional[DriverPublic] = None


class TransferForDriver(TransferBase):
    customer_name: str = ""
    customer_phone: str = ""
    pickup_distance_km: Optional[float] = None


class DriverProfileIn(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    city: Optional[str] = Field(default=None, max_length=80)
    aadhaar: Optional[str] = None
    pan: Optional[str] = None
    licence: Optional[str] = None
    licence_expiry: Optional[date] = None


class DriverMeOut(ORM):
    id: int
    full_name: str
    phone: str
    city: str
    aadhaar_last4: Optional[str] = None
    pan_last4: Optional[str] = None
    licence_last4: Optional[str] = None
    licence_expiry: Optional[date] = None
    kyc_status: str
    is_online: bool
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: float
    total_trips: int
    vehicle: Optional[VehicleOut] = None


class OnlineIn(BaseModel):
    online: bool


class LocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class OtpIn(BaseModel):
    otp: str = Field(min_length=4, max_length=4)


# ---------- documents ----------
class DocumentOut(ORM):
    id: int
    doc_type: str
    number_last4: Optional[str] = None
    status: str
    note: str
    content_type: str
    created_at: datetime


class AdminDocumentOut(DocumentOut):
    user_name: str
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    user_role: str


class ReviewIn(BaseModel):
    status: Literal["approved", "rejected"]
    note: str = ""
