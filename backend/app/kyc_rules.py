"""Document number validation and the verification rules used for bookings and drivers."""
import random
import re

_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]
_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]

DOC_TYPES = {"aadhaar", "pan", "driving_licence", "passport", "visa", "selfie", "vehicle_rc"}
ID_TYPES = ("aadhaar", "pan", "driving_licence")
DRIVER_DOCS = ["aadhaar", "pan", "driving_licence", "vehicle_rc", "selfie"]


def verhoeff_ok(number: str) -> bool:
    c = 0
    for i, ch in enumerate(reversed(number)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


def make_test_aadhaar() -> str:
    """Generates a checksum-valid DUMMY number for testing the form."""
    base = str(random.randint(2, 9)) + "".join(str(random.randint(0, 9)) for _ in range(10))
    c = 0
    for i, ch in enumerate(reversed(base)):
        c = _D[c][_P[(i + 1) % 8][int(ch)]]
    return base + str(_INV[c])


def validate_number(doc_type: str, number: str) -> str:
    n = re.sub(r"[\s-]", "", number or "").upper()
    if doc_type == "aadhaar":
        if not re.fullmatch(r"[2-9]\d{11}", n) or not verhoeff_ok(n):
            raise ValueError("Enter a valid 12-digit Aadhaar number")
    elif doc_type == "pan":
        if not re.fullmatch(r"[A-Z]{5}\d{4}[A-Z]", n):
            raise ValueError("PAN must look like ABCDE1234F")
    elif doc_type == "driving_licence":
        if not re.fullmatch(r"[A-Z]{2}\d{13}", n):
            raise ValueError("Driving licence must look like MH1220110012345")
    elif doc_type == "passport":
        if not re.fullmatch(r"[A-Z0-9]{6,9}", n):
            raise ValueError("Enter a valid passport number")
    elif doc_type == "visa":
        if not re.fullmatch(r"[A-Z0-9]{5,15}", n):
            raise ValueError("Enter a valid visa number")
    elif doc_type == "vehicle_rc":
        if not re.fullmatch(r"[A-Z0-9]{6,12}", n):
            raise ValueError("Enter the vehicle registration number")
    return n


def detect_type(data: bytes):
    """Checks the real file signature, not just the file name."""
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg", "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png", "image/png"
    if data.startswith(b"%PDF"):
        return "pdf", "application/pdf"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
    return None


def check_kyc(docs, package) -> dict:
    """Customer verification needed for a trip package."""
    by = {d.doc_type: d for d in docs}
    present = lambda t: t in by and by[t].status != "rejected"
    approved = lambda t: t in by and by[t].status == "approved"
    if package.is_international:
        need = ["passport"] + (["visa"] if package.visa_required else []) + ["selfie"]
        missing = [t for t in need if not present(t)]
        all_ok = all(approved(t) for t in need)
    else:
        missing = []
        if not any(present(t) for t in ID_TYPES):
            missing.append("aadhaar / pan / driving_licence")
        if not present("selfie"):
            missing.append("selfie")
        all_ok = any(approved(t) for t in ID_TYPES) and approved("selfie")
    return {"missing": missing, "submitted": not missing, "approved": all_ok}


def driver_kyc_status(docs) -> str:
    by = {d.doc_type: d for d in docs}
    if any(t in by and by[t].status == "rejected" for t in DRIVER_DOCS):
        return "rejected"
    if all(t in by and by[t].status == "approved" for t in DRIVER_DOCS):
        return "approved"
    if all(t in by for t in DRIVER_DOCS):
        return "pending"
    return "incomplete"
