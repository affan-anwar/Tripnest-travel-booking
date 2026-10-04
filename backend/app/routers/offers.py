from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Offer
from app.schemas import OfferCheckIn, OfferCheckOut, OfferOut

router = APIRouter(prefix="/api/offers", tags=["offers"])


def evaluate_offer(db: Session, code: str, amount: Decimal, kind: str, international: bool = False):
    """Validates a promo code and returns (offer, discount). Always recomputed on the server."""
    offer = db.scalar(select(Offer).where(Offer.code == code.strip().upper(), Offer.active.is_(True)))
    if not offer:
        raise HTTPException(status_code=400, detail="Invalid offer code")
    if offer.valid_until and offer.valid_until < date.today():
        raise HTTPException(status_code=400, detail="This offer has expired")
    if offer.applies_to == "stay" and kind != "stay":
        raise HTTPException(status_code=400, detail="This offer is only for hotel stays")
    if offer.applies_to in ("international", "domestic") and kind != "trip":
        raise HTTPException(status_code=400, detail="This offer is only for trip packages")
    if offer.applies_to == "international" and not international:
        raise HTTPException(status_code=400, detail="This offer is only for international trips")
    if offer.applies_to == "domestic" and international:
        raise HTTPException(status_code=400, detail="This offer is only for trips within India")
    if amount < offer.min_amount:
        raise HTTPException(status_code=400, detail=f"Minimum booking amount is Rs. {int(offer.min_amount):,}")
    discount = (amount * offer.discount_percent / 100).quantize(Decimal("0.01"))
    return offer, min(discount, offer.max_discount)


@router.get("", response_model=list[OfferOut])
def list_offers(db: Session = Depends(get_db)):
    stmt = select(Offer).where(Offer.active.is_(True), or_(Offer.valid_until.is_(None), Offer.valid_until >= date.today()))
    return db.scalars(stmt.order_by(Offer.id)).all()


@router.post("/check", response_model=OfferCheckOut)
def check_offer(data: OfferCheckIn, db: Session = Depends(get_db)):
    amount = Decimal(str(data.amount))
    offer, discount = evaluate_offer(db, data.code, amount, data.kind, data.international)
    return OfferCheckOut(code=offer.code, discount=float(discount), final_price=float(amount - discount), message=offer.title)
