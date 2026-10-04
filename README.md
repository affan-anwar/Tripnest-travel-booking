# TripNest - travel management and booking platform

Book worldwide trip packages and five-star hotel stays, then get picked up from the airport or railway station by a verified driver you can track live.

Designed and developed by **MD AFFAN ANWAR**.

**Stack:** React 18 + Vite, JavaScript, HTML5, CSS3 | Python, FastAPI, SQLAlchemy | PostgreSQL | Leaflet + OpenStreetMap

---

## Features

**Customer**
- Search and filter trip packages (India and worldwide, including Umrah to Makkah and Madinah) and book with passenger details
- Five-star hotels with photo galleries, room types, add-ons and special requests
- Offers and promo codes (discounts are recalculated on the server)
- Airport and railway station pickups with fare estimate, choice of vehicle, ride OTP and live tracking on a map
- Saved passengers, profile, settings, light and dark mode
- Identity verification: passport and visa for international trips; Aadhaar, PAN or driving licence for trips within India; selfie check
- Login with email and password or mobile OTP, and password reset

**Driver**
- Onboarding with profile, vehicle details and five documents (Aadhaar, PAN, driving licence, vehicle RC, selfie)
- Can go online only after an admin approves every document
- Receives ride requests for their vehicle type, shares live location, starts the trip with the passenger's OTP, sees earnings

**Admin**
- Full access: dashboard stats, users, drivers, document review and approval, bookings and activity
- Can also use every customer feature

---

## How it works

| Area | Approach |
|---|---|
| Authentication | JWT (HS256, 24 hours), bcrypt password hashes, role check on every protected route |
| Mobile OTP | 6-digit code, stored only as a hash, expires in 5 minutes, 5 attempts, 30-second resend wait. Sent by SMS through Twilio Verify, Twilio Messaging or Fast2SMS. In dev mode the code is shown on screen. |
| Password reset | One-time 6-digit code (10 minutes, limited attempts). The reply is identical whether or not the email exists. |
| Double booking | `SELECT ... FOR UPDATE` locks the room or package row while a booking is saved, so two users cannot take the last room or seat. Date overlap rule: `existing.check_in < new.check_out AND existing.check_out > new.check_in`. |
| Pricing | Offer discounts and totals are calculated on the server, never trusted from the browser. |
| Document verification | Real file type check by magic bytes (JPG, PNG, WEBP, PDF), 5 MB limit, checksum validation for Aadhaar (Verhoeff), regex for PAN and licence, only the last 4 characters of ID numbers stored, manual admin approval. |
| Ride fare | Base fare + per-km rate x road distance (straight-line distance x 1.3), with five vehicle types. |
| Ride lifecycle | requested, accepted, arrived, in trip, completed or cancelled. Driver earns 80 percent of the fare. |
| Live tracking | Driver location is sent to the server and the customer's map polls every 4 seconds. Routes come from OSRM. |
| Query performance | `selectinload` and `joinedload` to avoid N+1 queries. |
| Images | Landmark photos are loaded from Wikipedia and Wikimedia Commons with a fallback, and cached in the browser. |

---

## Run (Windows PowerShell)

```powershell
cd tripnest
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # once: database, .env, packages
powershell -ExecutionPolicy Bypass -File .\run.ps1     # every time: starts backend + frontend
```

Frontend: http://localhost:5173 - API docs: http://localhost:8000/docs

Or start them yourself in two terminals:

```powershell
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
```powershell
cd frontend
npm run dev
```

If you change the database models, run `.\reset-db.ps1` and start again (sample data is re-seeded).

### Settings (`backend/.env`, see `backend/.env.example`)

| Setting | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `SECRET_KEY` | Signs login tokens. Use a long random value. |
| `SMS_PROVIDER` | `console` (code shown on screen), `twilio_verify`, `twilio` or `fast2sms` |
| `TWILIO_*`, `FAST2SMS_API_KEY` | Provider keys. Never commit `.env`. |
| `ADMIN_SIGNUP_CODE` | Code required to create an admin account. Change it. |

---

## Test accounts (created by the seed script on your own machine)

| Role | Email | Password |
|---|---|---|
| Customer | customer@tripnest.com | Customer@123 |
| Driver (sedan, approved, online) | driver1@tripnest.com | Driver@123 |
| Driver (SUV / luxury / tempo / hatchback) | driver2..5@tripnest.com | Driver@123 |
| Admin | admin@tripnest.com | Admin@123 |

---

## Try these flows

1. **Hotel stay:** Hotels > open a hotel > pick room, dates, add-ons, offer `STAY12` > Confirm stay.
2. **Airport ride with live tracking:** log in as customer > Airport rides > choose pickup and drop > choose vehicle > Book. On the tracking page press **Simulate next driver step** to watch the car move.
3. **Trip booking with verification:** Account > Verification, upload an Aadhaar (or PAN / licence) and a selfie, then book a trip. The booking stays `pending_verification` until the admin approves the documents (Admin > Document review).
4. **Driver onboarding:** sign up as a driver, fill in details and vehicle, upload 5 documents, then approve them as admin.

---

## Challenges and how I solved them

| Problem | Fix |
|---|---|
| Two users could book the last room at the same time | Row-level locking with `SELECT ... FOR UPDATE` and a date overlap check inside one transaction |
| PostgreSQL "password authentication failed" during setup | Reset the postgres user's password, URL-encoded special characters in `DATABASE_URL`, and tested the connection before starting the app |
| Hotel and trip photos did not load | Keyword-based photo links were unreliable. Switched to Wikipedia and Wikimedia images with a fallback and caching |
| Ports 5173 and 8000 already in use | Stopped leftover server processes and started Vite with `--strictPort` |
| Install failed because the disk was full | Cleared npm and pip caches and old `node_modules` |
| Taj Mahal package showed the wrong state | Corrected the seed data (Agra, Uttar Pradesh) |
| Layout broke on phones | Responsive CSS grid, media queries and a hamburger menu |
| Slow pages from repeated queries | Eager loading to remove N+1 queries |

---

## Folder map

```
backend/app
  models.py        all database tables
  schemas.py       request/response validation (Pydantic)
  security.py      JWT and password hashing
  deps.py          current user and role checks
  geo.py           distance (haversine) and fare table
  kyc_rules.py     document number checks (Aadhaar Verhoeff, PAN, licence) and verification rules
  otp.py           mobile OTP (hashed, expiring, rate limited, SMS providers)
  seed.py          sample packages, hotels, airports and stations, drivers, offers
  routers/         auth, me, packages, offers, bookings, hotels, transfers,
                   driver, kyc, admin, payments
frontend/src
  pages/           Home, PackageDetails, Hotels, HotelDetails, Transfers, Track, MyTrips,
                   Account, AuthPage, ForgotPassword, Driver, Admin, About, Contact, Privacy, Terms
  components/      LiveMap, DocsManager, PassengerForm, Navbar, Footer, cards, SafeImg
```

---

## Current scope and production roadmap

- Hotel listings and prices are sample data. Live inventory and prices need a supplier or channel-manager API.
- Weather (Open-Meteo), exchange rates (open.er-api.com), maps (OpenStreetMap) and routes (OSRM) are real and need no key.
- Live tracking uses polling every 4 seconds. WebSockets would be the next step.
- Document checks are an upload, format validation and manual admin review. Real Aadhaar, PAN and licence verification and face matching need a licensed provider. Do not upload real documents while testing.
- Payment checkout is simulated. Connecting Razorpay or Stripe with webhooks is the next integration.
- Password reset codes are shown on screen in dev mode. For production they should be sent by email (SMTP or an email API).

---

## Ideas for next steps

WebSockets for tracking, real payment gateway, email delivery, automated tests, Docker and deployment.
