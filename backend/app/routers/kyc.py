import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import config
from app.database import get_db
from app.deps import get_current_user, require_role
from app.kyc_rules import DOC_TYPES, check_kyc, detect_type, driver_kyc_status, validate_number
from app.models import Booking, Document, Driver, User
from app.schemas import AdminDocumentOut, DocumentOut, ReviewIn

router = APIRouter(prefix="/api/kyc", tags=["verification"])
MAX_BYTES = 5 * 1024 * 1024


def _remove(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


def _save_file(user_id: int, upload: UploadFile):
    data = upload.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 5 MB")
    kind = detect_type(data)
    if not kind:
        raise HTTPException(status_code=400, detail="Upload a JPG, PNG, WEBP or PDF file")
    ext, mime = kind
    folder = os.path.join(config.UPLOAD_DIR, str(user_id))
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f"{uuid.uuid4().hex}.{ext}")
    with open(path, "wb") as f:
        f.write(data)
    return path, mime


def sync_after_change(db: Session, user_id: int) -> None:
    """Re-evaluates driver KYC status and customers' pending trip bookings after a document changes."""
    user = db.get(User, user_id)
    docs = db.scalars(select(Document).where(Document.user_id == user_id)).all()
    if user.role == "driver":
        driver = db.scalar(select(Driver).where(Driver.user_id == user_id))
        if driver:
            driver.kyc_status = driver_kyc_status(docs)
            if driver.kyc_status != "approved":
                driver.is_online = False
    else:
        pending = db.scalars(
            select(Booking).options(joinedload(Booking.package))
            .where(Booking.user_id == user_id, Booking.status == "pending_verification")
        ).all()
        for booking in pending:
            if check_kyc(docs, booking.package)["approved"]:
                booking.status = "confirmed"
    db.commit()


@router.get("/documents", response_model=list[DocumentOut])
def my_documents(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Document).where(Document.user_id == user.id).order_by(Document.id)).all()


@router.post("/documents", response_model=DocumentOut)
def upload_document(
    doc_type: str = Form(...),
    number: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == "admin" or doc_type not in DOC_TYPES:
        raise HTTPException(status_code=400, detail="Unknown document type")
    if doc_type == "vehicle_rc" and user.role != "driver":
        raise HTTPException(status_code=400, detail="Only drivers upload a vehicle RC")

    last4 = None
    if doc_type != "selfie":
        try:
            last4 = validate_number(doc_type, number)[-4:]
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    path, mime = _save_file(user.id, file)
    if doc_type == "selfie" and mime == "application/pdf":
        _remove(path)
        raise HTTPException(status_code=400, detail="Selfie must be a photo")

    doc = db.scalar(select(Document).where(Document.user_id == user.id, Document.doc_type == doc_type))
    if doc:
        _remove(doc.file_path)
        doc.number_last4, doc.file_path, doc.content_type = last4, path, mime
        doc.status, doc.note = "pending", ""
    else:
        doc = Document(user_id=user.id, doc_type=doc_type, number_last4=last4, file_path=path, content_type=mime)
        db.add(doc)
    db.commit()
    sync_after_change(db, user.id)
    db.refresh(doc)
    return doc


@router.get("/documents/{doc_id}/file")
def document_file(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc or (doc.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File missing")
    return FileResponse(doc.file_path, media_type=doc.content_type)


@router.get("/admin/pending", response_model=list[AdminDocumentOut], dependencies=[Depends(require_role("admin"))])
def pending_documents(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Document, User).join(User, Document.user_id == User.id)
        .where(Document.status == "pending").order_by(Document.created_at)
    ).all()
    return [
        AdminDocumentOut(
            id=d.id, doc_type=d.doc_type, number_last4=d.number_last4, status=d.status, note=d.note,
            content_type=d.content_type, created_at=d.created_at, user_name=u.name,
            user_email=u.email, user_phone=u.phone, user_role=u.role,
        )
        for d, u in rows
    ]


@router.post("/admin/documents/{doc_id}/review", response_model=DocumentOut, dependencies=[Depends(require_role("admin"))])
def review_document(doc_id: int, data: ReviewIn, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.status, doc.note = data.status, data.note[:255]
    db.commit()
    sync_after_change(db, doc.user_id)
    db.refresh(doc)
    return doc
