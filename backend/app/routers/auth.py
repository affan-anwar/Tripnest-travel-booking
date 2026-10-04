import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import config

from app.database import get_db
from app.deps import get_current_user
from app.models import Driver, PasswordReset, User
from app.otp import normalize_phone, send_otp, verify_otp
from app.schemas import ForgotIn, LoginIn, OtpSendIn, OtpVerifyIn, RegisterIn, ResetIn, TokenOut, UserOut
from app.security import SECRET_KEY, create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if data.role == "admin" and not hmac.compare_digest((data.admin_code or "").encode(), config.ADMIN_SIGNUP_CODE.encode()):
        raise HTTPException(status_code=403, detail="Incorrect admin access code")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email already registered")
    phone = normalize_phone(data.phone) if data.phone else None
    if phone and db.scalar(select(User).where(User.phone == phone)):
        raise HTTPException(status_code=409, detail="Mobile number already registered")
    user = User(
        name=data.name, email=email, phone=phone, address=(data.address or "").strip(),
        password_hash=hash_password(data.password), role=data.role,
    )
    db.add(user)
    db.flush()
    if data.role == "driver":
        db.add(Driver(user_id=user.id, full_name=data.name))
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_token(user.id), user=user)


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return TokenOut(access_token=create_token(user.id), user=user)


@router.post("/otp/send")
def otp_send(data: OtpSendIn, db: Session = Depends(get_db)):
    return send_otp(db, normalize_phone(data.phone))


@router.post("/otp/verify", response_model=TokenOut)
def otp_verify(data: OtpVerifyIn, db: Session = Depends(get_db)):
    phone = normalize_phone(data.phone)
    verify_otp(db, phone, data.code)
    user = db.scalar(select(User).where(User.phone == phone))
    if not user:
        user = User(name=(data.name or "").strip() or "Traveller", phone=phone, role="customer")
        db.add(user)
        db.commit()
        db.refresh(user)
    return TokenOut(access_token=create_token(user.id), user=user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


RESET_TTL = timedelta(minutes=10)
RESET_WAIT_SECONDS = 30
RESET_MAX_ATTEMPTS = 5


def _reset_hash(email: str, code: str) -> str:
    return hmac.new(SECRET_KEY.encode(), f"reset:{email}:{code}".encode(), hashlib.sha256).hexdigest()


@router.post("/forgot-password")
def forgot_password(data: ForgotIn, db: Session = Depends(get_db)):
    """Sends a reset code. The reply is the same whether or not the email exists, so accounts cannot be probed.
    In dev mode the code is printed in the server console and returned to the UI (no email service is configured)."""
    email = data.email.lower()
    reply = {"message": "If this email has an account, a reset code has been sent."}
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        return reply
    now = datetime.now(timezone.utc)
    last = db.scalar(select(PasswordReset).where(PasswordReset.email == email).order_by(PasswordReset.created_at.desc()))
    if last and (now - last.created_at).total_seconds() < RESET_WAIT_SECONDS:
        raise HTTPException(status_code=429, detail="Wait 30 seconds before requesting another code")
    db.execute(delete(PasswordReset).where(PasswordReset.email == email))
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(PasswordReset(email=email, code_hash=_reset_hash(email, code), expires_at=now + RESET_TTL))
    db.commit()
    print(f"[DEV RESET CODE] {email}: {code}")  # Production: send this by email instead.
    if config.OTP_DEV_MODE:
        reply["dev_code"] = code
    return reply


@router.post("/reset-password")
def reset_password(data: ResetIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    row = db.scalar(select(PasswordReset).where(PasswordReset.email == email).order_by(PasswordReset.created_at.desc()))
    if not row:
        raise HTTPException(status_code=400, detail="Request a reset code first")
    if row.expires_at < datetime.now(timezone.utc):
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=400, detail="This code has expired. Request a new one")
    if row.attempts >= RESET_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Request a new code")
    if not hmac.compare_digest(row.code_hash, _reset_hash(email, data.code)):
        row.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect code")
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=400, detail="Request a reset code first")
    user.password_hash = hash_password(data.new_password)
    db.delete(row)
    db.commit()
    return {"message": "Password updated. You can log in now."}
