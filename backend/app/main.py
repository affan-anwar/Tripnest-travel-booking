import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config, models  # noqa: F401  (registers tables)
from app.database import Base, SessionLocal, engine
from app.routers import admin, auth, bookings, driver, hotels, kyc, me, offers, packages, payments, transfers
from app.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    os.makedirs(config.UPLOAD_DIR, exist_ok=True)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(
    title="TripNest API",
    description="Travel management and booking platform. Designed and developed by MD AFFAN ANWAR (developer and owner).",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, me, packages, offers, bookings, hotels, transfers, driver, kyc, admin, payments):
    app.include_router(module.router)


@app.get("/")
def health():
    return {"status": "ok", "app": "TripNest", "developer": "MD AFFAN ANWAR"}
