from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_role
from app.models import Booking, Stay, Transfer, User

router = APIRouter(prefix="/api/pay", tags=["payments"])
MODELS = {"booking": Booking, "stay": Stay, "transfer": Transfer}


@router.post("/{kind}/{item_id}")
def demo_payment(kind: str, item_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("customer"))):
    """Demo gateway: marks an item as paid. Replace with Razorpay / Stripe + a webhook in production."""
    model = MODELS.get(kind)
    item = db.get(model, item_id) if model else None
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cancelled bookings cannot be paid")
    item.payment_status = "paid"
    db.commit()
    return {"payment_status": "paid"}
