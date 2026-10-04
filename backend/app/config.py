import os

from dotenv import load_dotenv

load_dotenv()

OTP_DEV_MODE = os.getenv("OTP_DEV_MODE", "true").strip().lower() == "true"
DEMO_MODE = os.getenv("DEMO_MODE", "true").strip().lower() == "true"
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
# Extra browser origins allowed to call the API (comma separated), e.g. your deployed frontend address.
FRONTEND_ORIGINS = [o.strip().rstrip("/") for o in os.getenv("FRONTEND_ORIGINS", "").split(",") if o.strip()]
# Local default true: creates the test admin and customer accounts. Set false on a public deployment.
SEED_DEMO_LOGINS = os.getenv("SEED_DEMO_LOGINS", "true").strip().lower() == "true"

# Admin sign-up needs this code, so strangers cannot create admin accounts. Change it in backend/.env.
ADMIN_SIGNUP_CODE = os.getenv("ADMIN_SIGNUP_CODE", "TripNestAdmin@2026")

# Mobile OTP delivery: console (dev, code shown on screen) | fast2sms (India) | twilio (worldwide).
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "console").strip().lower()
FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "").strip()
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "").strip()
TWILIO_MESSAGING_SERVICE_SID = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "").strip()  # starts with MG (Messaging > Services)
TWILIO_VERIFY_SERVICE_SID = os.getenv("TWILIO_VERIFY_SERVICE_SID", "").strip()  # starts with VA (Verify > Services)
