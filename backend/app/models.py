import json
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _json_list(value: str) -> list:
    try:
        return json.loads(value or "[]")
    except ValueError:
        return []


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="customer")  # customer | driver | admin
    address: Mapped[str] = mapped_column(String(255), default="")
    nationality: Mapped[str] = mapped_column(String(60), default="")
    dob: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    emergency_name: Mapped[str] = mapped_column(String(100), default="")
    emergency_phone: Mapped[str] = mapped_column(String(20), default="")
    theme: Mapped[str] = mapped_column(String(10), default="system")
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    notify_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_sms: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    driver: Mapped[Optional["Driver"]] = relationship(back_populates="user", uselist=False)


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PasswordReset(Base):
    """One-time code for resetting a forgotten password (hashed, expires, limited attempts)."""

    __tablename__ = "password_resets"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Document(Base):
    """KYC upload. doc_type: aadhaar | pan | driving_licence | passport | visa | selfie | vehicle_rc"""

    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("user_id", "doc_type", name="uq_user_doctype"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    doc_type: Mapped[str] = mapped_column(String(20))
    number_last4: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    file_path: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    note: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()


class Passenger(Base):
    """Saved traveller details on a customer's account."""

    __tablename__ = "passengers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    full_name: Mapped[str] = mapped_column(String(100))
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[str] = mapped_column(String(10), default="male")
    nationality: Mapped[str] = mapped_column(String(60), default="")
    id_type: Mapped[str] = mapped_column(String(20), default="")
    id_last4: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)


class Package(Base):
    __tablename__ = "packages"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    destination: Mapped[str] = mapped_column(String(100), index=True)
    country: Mapped[str] = mapped_column(String(80), default="India")
    continent: Mapped[str] = mapped_column(String(30), default="Asia")
    category: Mapped[str] = mapped_column(String(30), default="City")
    is_international: Mapped[bool] = mapped_column(Boolean, default=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    visa_required: Mapped[bool] = mapped_column(Boolean, default=False)
    latitude: Mapped[float] = mapped_column(Float, default=0.0)
    longitude: Mapped[float] = mapped_column(Float, default=0.0)
    description: Mapped[str] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    duration_days: Mapped[int] = mapped_column(Integer)
    seats: Mapped[int] = mapped_column(Integer, default=20)
    image_url: Mapped[str] = mapped_column(String(500), default="")


class Offer(Base):
    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(255), default="")
    discount_percent: Mapped[int] = mapped_column(Integer)
    max_discount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    min_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    applies_to: Mapped[str] = mapped_column(String(20), default="all")  # all | international | domestic | stay
    valid_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Booking(Base):
    """Trip package booking."""

    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id"), index=True)
    travelers: Mapped[int] = mapped_column(Integer)
    travel_date: Mapped[date] = mapped_column(Date)
    passengers_json: Mapped[str] = mapped_column(Text, default="[]")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    offer_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(30), default="confirmed")
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()
    package: Mapped["Package"] = relationship()

    @property
    def passengers(self) -> list:
        return _json_list(self.passengers_json)


class Hotel(Base):
    __tablename__ = "hotels"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    city: Mapped[str] = mapped_column(String(80), index=True)
    country: Mapped[str] = mapped_column(String(80))
    address: Mapped[str] = mapped_column(String(255), default="")
    star_rating: Mapped[int] = mapped_column(Integer, default=5)
    description: Mapped[str] = mapped_column(Text, default="")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)
    amenities: Mapped[str] = mapped_column(Text, default="")  # comma separated
    images: Mapped[str] = mapped_column(Text, default="")  # | separated URLs
    check_in_time: Mapped[str] = mapped_column(String(10), default="14:00")
    check_out_time: Mapped[str] = mapped_column(String(10), default="11:00")
    cancellation_policy: Mapped[str] = mapped_column(Text, default="")
    nearest_airport: Mapped[str] = mapped_column(String(100), default="")
    airport_distance_km: Mapped[float] = mapped_column(Float, default=0.0)

    rooms: Mapped[list["RoomType"]] = relationship(
        back_populates="hotel", order_by="RoomType.price_per_night"
    )

    @property
    def from_price(self) -> Optional[float]:
        return float(min(r.price_per_night for r in self.rooms)) if self.rooms else None


class RoomType(Base):
    __tablename__ = "room_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    bed_type: Mapped[str] = mapped_column(String(50), default="King bed")
    size_sqm: Mapped[int] = mapped_column(Integer, default=35)
    max_guests: Mapped[int] = mapped_column(Integer, default=2)
    price_per_night: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    breakfast_included: Mapped[bool] = mapped_column(Boolean, default=True)
    refundable: Mapped[bool] = mapped_column(Boolean, default=True)
    rooms_available: Mapped[int] = mapped_column(Integer, default=10)
    image_url: Mapped[str] = mapped_column(String(500), default="")
    features: Mapped[str] = mapped_column(Text, default="")  # comma separated

    hotel: Mapped["Hotel"] = relationship(back_populates="rooms")


class Stay(Base):
    """Hotel booking."""

    __tablename__ = "stays"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), index=True)
    room_type_id: Mapped[int] = mapped_column(ForeignKey("room_types.id"), index=True)
    check_in: Mapped[date] = mapped_column(Date)
    check_out: Mapped[date] = mapped_column(Date)
    nights: Mapped[int] = mapped_column(Integer)
    rooms: Mapped[int] = mapped_column(Integer, default=1)
    guests: Mapped[int] = mapped_column(Integer, default=1)
    addons: Mapped[str] = mapped_column(Text, default="")
    addons_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    guest_json: Mapped[str] = mapped_column(Text, default="[]")
    special_requests: Mapped[str] = mapped_column(Text, default="")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    offer_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()
    hotel: Mapped["Hotel"] = relationship()
    room_type: Mapped["RoomType"] = relationship()

    @property
    def guest_details(self) -> list:
        return _json_list(self.guest_json)


class Place(Base):
    """Airports and railway stations used for pickups and drops."""

    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(10), index=True)  # airport | railway
    name: Mapped[str] = mapped_column(String(150))
    code: Mapped[str] = mapped_column(String(10), default="")
    city: Mapped[str] = mapped_column(String(80))
    country: Mapped[str] = mapped_column(String(80), default="India")
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20), default="")
    city: Mapped[str] = mapped_column(String(80), default="")
    aadhaar_last4: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    pan_last4: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    licence_last4: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    licence_expiry: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    kyc_status: Mapped[str] = mapped_column(String(20), default="incomplete")
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=4.8)
    total_trips: Mapped[int] = mapped_column(Integer, default=0)

    user: Mapped["User"] = relationship(back_populates="driver")
    vehicle: Mapped[Optional["Vehicle"]] = relationship(
        back_populates="driver", uselist=False, cascade="all, delete-orphan"
    )


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"), unique=True)
    category: Mapped[str] = mapped_column(String(20))
    make_model: Mapped[str] = mapped_column(String(80))
    plate_number: Mapped[str] = mapped_column(String(20))
    color: Mapped[str] = mapped_column(String(30), default="White")
    seats: Mapped[int] = mapped_column(Integer, default=4)
    ac: Mapped[bool] = mapped_column(Boolean, default=True)

    driver: Mapped["Driver"] = relationship(back_populates="vehicle")


class Transfer(Base):
    """Airport / railway station <-> hotel cab booking with live tracking."""

    __tablename__ = "transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    driver_id: Mapped[Optional[int]] = mapped_column(ForeignKey("drivers.id"), nullable=True, index=True)
    pickup_name: Mapped[str] = mapped_column(String(150))
    pickup_lat: Mapped[float] = mapped_column(Float)
    pickup_lng: Mapped[float] = mapped_column(Float)
    drop_name: Mapped[str] = mapped_column(String(150))
    drop_lat: Mapped[float] = mapped_column(Float)
    drop_lng: Mapped[float] = mapped_column(Float)
    pickup_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    passengers: Mapped[int] = mapped_column(Integer, default=1)
    luggage: Mapped[int] = mapped_column(Integer, default=0)
    vehicle_category: Mapped[str] = mapped_column(String(20))
    flight_or_train: Mapped[str] = mapped_column(String(30), default="")
    notes: Mapped[str] = mapped_column(String(255), default="")
    distance_km: Mapped[float] = mapped_column(Float)
    fare: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    # requested -> accepted -> arrived -> in_trip -> completed (or cancelled)
    status: Mapped[str] = mapped_column(String(20), default="requested", index=True)
    ride_otp: Mapped[str] = mapped_column(String(4))
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship()
    driver: Mapped[Optional["Driver"]] = relationship()

    @property
    def customer_name(self) -> str:
        return self.user.name if self.user else ""

    @property
    def customer_phone(self) -> str:
        return (self.user.phone or "") if self.user else ""
