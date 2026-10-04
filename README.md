# TripNest - travel management and booking platform

Designed and developed by **MD AFFAN ANWAR** (developer and owner).

Stack: React.js, JavaScript, HTML5, CSS3 | Python, FastAPI, SQLAlchemy | PostgreSQL | Leaflet + OpenStreetMap.

## Run (Windows PowerShell)

```powershell
cd tripnest
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # once: database, .env, packages
powershell -ExecutionPolicy Bypass -File .\run.ps1     # every time: starts backend + frontend
```

Frontend: http://localhost:5173 - API docs: http://localhost:8000/docs

If you change the database models, run `.\reset-db.ps1` and start again (demo data is re-seeded).

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Traveller | customer@tripnest.com | Customer@123 |
| Driver (sedan, approved, online) | driver1@tripnest.com | Driver@123 |
| Driver (SUV / luxury / tempo / hatchback) | driver2..5@tripnest.com | Driver@123 |
| Admin | admin@tripnest.com | Admin@123 |

Mobile OTP login works in dev mode: the OTP is shown on screen and printed in the backend terminal.

## Try these flows

1. **Hotel stay**: Hotels > open a hotel > pick room, dates, add-ons, offer `STAY12` > Confirm stay.
2. **Airport ride with live tracking**: log in as traveller > "Airport and station rides" > pickup airport, drop hotel > choose vehicle > Book.
   On the tracking page press **Simulate next driver step** to watch the car move on the map.
   To use a real driver window instead: log in as `driver1@tripnest.com` in another browser, accept the request, press "Drive to pickup (demo)".
3. **Trip booking with verification**: Account > Verification, upload an Aadhaar (or PAN / licence) and a selfie, then book a trip.
   The booking stays `pending_verification` until the admin approves your documents (Admin > Document review).
   Generate a checksum-valid DUMMY Aadhaar number: `cd backend; .\venv\Scripts\python.exe -c "from app.kyc_rules import make_test_aadhaar; print(make_test_aadhaar())"`
4. **Driver onboarding**: sign up as a driver, fill identity details and vehicle, upload 5 documents, then approve them as admin.

## Folder map

```
backend/app
  models.py        all database tables
  schemas.py       request/response validation (Pydantic)
  geo.py           distance (haversine) and fare table
  kyc_rules.py     document number checks (Aadhaar Verhoeff, PAN, licence...) and verification rules
  otp.py           mobile OTP (hashed, expiring, rate limited)
  seed.py          demo packages, hotels, airports/stations, drivers, offers
  routers/         auth, me (profile/settings/passengers), packages, offers, bookings,
                   hotels (stays), transfers (rides + tracking), driver, kyc, admin, payments
frontend/src
  pages/           Home, PackageDetails, Hotels, HotelDetails, Transfers, Track, MyTrips,
                   Account, AuthPage, Driver, Admin, About
  components/      LiveMap, DocsManager, PassengerForm, Navbar, Footer, cards
```

## Honest limits (good to say in an interview)

- Prices are indicative demo prices; hotels are fictional demo properties. Real prices need a paid supplier API.
- Live weather (Open-Meteo), exchange rates (open.er-api.com), maps (OpenStreetMap) and routes (OSRM) are real and keyless.
- Live tracking uses polling every 4 seconds; the driver position comes from browser GPS or the demo simulator.
- Document checks are upload + format validation + manual admin review. Real Aadhaar/PAN/DL verification and face matching need a licensed provider.
- Only the last 4 characters of ID numbers are stored. Do not upload real documents while testing.
- Payments are a demo toggle; real payments need Razorpay or Stripe with webhooks.
- SMS OTP prints to the console in dev mode; plug a provider into `otp._deliver`.
