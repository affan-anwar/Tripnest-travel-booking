"""Mobile OTP. With SMS_PROVIDER=console (default) the code is printed in the server console and shown in the UI.
With SMS_PROVIDER=fast2sms or twilio the code is texted to the phone and never sent back to the browser."""
import hashlib
import hmac
import base64
import json
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import config
from app.models import OtpCode
from app.security import SECRET_KEY

OTP_TTL = timedelta(minutes=5)
RESEND_WAIT_SECONDS = 30
MAX_ATTEMPTS = 5


def normalize_phone(raw: str) -> str:
    cleaned = re.sub(r"[^\d+]", "", raw or "")
    if cleaned.startswith("+"):
        digits = cleaned[1:]
    elif len(cleaned) == 10:
        digits = "91" + cleaned
    else:
        digits = cleaned
    if not digits.isdigit() or not 10 <= len(digits) <= 15:
        raise HTTPException(status_code=400, detail="Enter a valid mobile number")
    return "+" + digits


def _hash(phone: str, code: str) -> str:
    return hmac.new(SECRET_KEY.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def _post(url: str, data: dict | None, headers: dict) -> None:
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    request = urllib.request.Request(url, data=body, headers=headers, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = response.read().decode("utf-8", "replace")
        if response.status >= 300:
            raise RuntimeError(payload[:200])
        return payload


def _twilio_auth() -> dict:
    token = base64.b64encode(f"{config.TWILIO_ACCOUNT_SID}:{config.TWILIO_AUTH_TOKEN}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def _verify_call(path: str, data: dict) -> dict:
    """Twilio Verify: Twilio creates, texts and checks the code itself."""
    if not (config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN and config.TWILIO_VERIFY_SERVICE_SID):
        raise RuntimeError("Twilio Verify keys are missing in backend/.env")
    url = f"https://verify.twilio.com/v2/Services/{config.TWILIO_VERIFY_SERVICE_SID}/{path}"
    try:
        return json.loads(_post(url, data, _twilio_auth()) or "{}")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"twilio_verify replied {exc.code}: {exc.read().decode('utf-8', 'replace')[:160]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach Twilio: {exc.reason}") from exc


def _deliver(phone: str, code: str) -> None:
    """Texts the code. Raises RuntimeError with a short reason if the provider refuses."""
    provider = config.SMS_PROVIDER
    if provider == "console":
        print(f"[DEV OTP] {phone}: {code}")
        return
    try:
        if provider == "fast2sms":
            if not config.FAST2SMS_API_KEY:
                raise RuntimeError("FAST2SMS_API_KEY is missing in backend/.env")
            if not phone.startswith("+91"):
                raise RuntimeError("Fast2SMS sends to Indian numbers only")
            query = urllib.parse.urlencode({"route": "otp", "variables_values": code, "numbers": phone[3:], "flash": 0})
            payload = _post(f"https://www.fast2sms.com/dev/bulkV2?{query}", None, {"authorization": config.FAST2SMS_API_KEY, "cache-control": "no-cache"})
            if not json.loads(payload or "{}").get("return"):
                raise RuntimeError(json.loads(payload).get("message", "Fast2SMS rejected the request"))
        elif provider == "twilio":
            sender = config.TWILIO_MESSAGING_SERVICE_SID or config.TWILIO_FROM_NUMBER
            if not (config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN and sender):
                raise RuntimeError("Twilio keys are missing in backend/.env")
            field = "MessagingServiceSid" if config.TWILIO_MESSAGING_SERVICE_SID else "From"
            _post(
                f"https://api.twilio.com/2010-04-01/Accounts/{config.TWILIO_ACCOUNT_SID}/Messages.json",
                {"To": phone, field: sender, "Body": f"{code} is your TripNest verification code. It is valid for 5 minutes. Do not share it."},
                _twilio_auth(),
            )
        else:
            raise RuntimeError(f"Unknown SMS_PROVIDER '{provider}'")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"{provider} replied {exc.code}: {exc.read().decode('utf-8', 'replace')[:160]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach {provider}: {exc.reason}") from exc


def send_otp(db: Session, phone: str) -> dict:
    if config.SMS_PROVIDER == "twilio_verify":
        try:
            _verify_call("Verifications", {"To": phone, "Channel": "sms"})
        except RuntimeError as exc:
            print(f"[SMS ERROR] {exc}")
            raise HTTPException(status_code=502, detail="Could not send the SMS right now. Check the number or try again.")
        return {"message": "OTP sent"}
    if config.SMS_PROVIDER == "console" and not config.OTP_DEV_MODE:
        raise HTTPException(status_code=503, detail="SMS provider is not configured")
    now = datetime.now(timezone.utc)
    last = db.scalar(select(OtpCode).where(OtpCode.phone == phone).order_by(OtpCode.created_at.desc()))
    if last and (now - last.created_at).total_seconds() < RESEND_WAIT_SECONDS:
        raise HTTPException(status_code=429, detail="Wait 30 seconds before requesting another OTP")
    db.execute(delete(OtpCode).where(OtpCode.phone == phone))
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(OtpCode(phone=phone, code_hash=_hash(phone, code), expires_at=now + OTP_TTL))
    db.commit()
    try:
        _deliver(phone, code)
    except RuntimeError as exc:
        print(f"[SMS ERROR] {exc}")
        db.execute(delete(OtpCode).where(OtpCode.phone == phone))
        db.commit()
        raise HTTPException(status_code=502, detail="Could not send the SMS right now. Check the number or try again.")
    reply = {"message": "OTP sent"}
    if config.SMS_PROVIDER == "console":
        reply["dev_otp"] = code  # dev only: never returned when a real SMS provider is used
    return reply


def verify_otp(db: Session, phone: str, code: str) -> None:
    if config.SMS_PROVIDER == "twilio_verify":
        try:
            result = _verify_call("VerificationCheck", {"To": phone, "Code": code})
        except RuntimeError as exc:
            print(f"[SMS ERROR] {exc}")
            raise HTTPException(status_code=400, detail="Incorrect or expired OTP. Request a new one")
        if result.get("status") != "approved":
            raise HTTPException(status_code=400, detail="Incorrect OTP")
        return
    otp = db.scalar(select(OtpCode).where(OtpCode.phone == phone).order_by(OtpCode.created_at.desc()))
    if not otp:
        raise HTTPException(status_code=400, detail="Request an OTP first")
    if otp.expires_at < datetime.now(timezone.utc):
        db.delete(otp)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one")
    if otp.attempts >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Request a new OTP")
    if not hmac.compare_digest(otp.code_hash, _hash(phone, code)):
        otp.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect OTP")
    db.delete(otp)
    db.commit()
