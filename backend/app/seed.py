"""Sample data. Prices are indicative starting prices in INR, hotels are fictional sample hotels."""
import secrets
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import config
from app.models import Driver, Hotel, Offer, Package, Place, RoomType, User, Vehicle
from app.security import hash_password

UNSPLASH = "https://images.unsplash.com/"
BEACH = UNSPLASH + "photo-1507525428034-b723cf961d3e?w=800"
EIFFEL = UNSPLASH + "photo-1502602898657-3e91760cbb34?w=800"
MOUNTAIN = UNSPLASH + "photo-1506905925346-21bda4d32df4?w=800"
TAJ = UNSPLASH + "photo-1524492412937-b28074a5d7da?w=800"
MALDIVES = UNSPLASH + "photo-1540541338287-41700207dee6?w=800"


def img(keyword: str, lock: int, w: int = 800, h: int = 500) -> str:
    return keyword if keyword.startswith("http") else f"https://loremflickr.com/{w}/{h}/{keyword}?lock={lock}"


# title, destination, country, continent, category, international, currency, visa, lat, lon, price, days, image, description
PACKAGES = [
    ("Goa Beach Escape", "Goa", "India", "Asia", "Beach", False, "INR", False, 15.4909, 73.8278, 18999, 5, BEACH, "4 nights at a beachfront resort with airport transfers and a sunset cruise."),
    ("Himalayan Trek", "Manali, Himachal Pradesh", "India", "Asia", "Adventure", False, "INR", False, 32.2432, 77.1892, 14999, 6, MOUNTAIN, "Guided trek with camping, meals, a guide and all permits."),
    ("Taj Mahal and Agra", "Agra, Uttar Pradesh", "India", "Asia", "Heritage", False, "INR", False, 27.1751, 78.0421, 12999, 3, TAJ, "Sunrise at the Taj Mahal, Agra Fort and Mehtab Bagh with a heritage hotel stay."),
    ("Royal Rajasthan", "Jaipur, Rajasthan", "India", "Asia", "Heritage", False, "INR", False, 26.9124, 75.7873, 21999, 5, "jaipur,palace", "Amber Fort, City Palace, Hawa Mahal and a desert camp experience."),
    ("Kerala Backwaters", "Alleppey, Kerala", "India", "Asia", "Beach", False, "INR", False, 9.4981, 76.3388, 24999, 5, "kerala,backwaters", "Houseboat stay, Munnar tea hills and an Ayurvedic spa session."),
    ("Leh Ladakh Road Trip", "Leh, Ladakh", "India", "Asia", "Adventure", False, "INR", False, 34.1526, 77.5770, 32999, 7, "ladakh,mountains", "Pangong Lake, Nubra Valley and monasteries with acclimatisation days."),
    ("Dubai Delight", "Dubai", "United Arab Emirates", "Asia", "City", True, "AED", True, 25.2048, 55.2708, 62999, 5, "dubai,skyline", "Burj Khalifa, desert safari, Marina cruise and Old Dubai souks."),
    ("Thailand Escape", "Bangkok and Phuket", "Thailand", "Asia", "Beach", True, "THB", True, 13.7563, 100.5018, 49999, 6, "thailand,beach", "Bangkok temples, Phi Phi island tour and Phuket beaches."),
    ("Singapore Highlights", "Singapore", "Singapore", "Asia", "City", True, "SGD", True, 1.3521, 103.8198, 74999, 5, "singapore,marina", "Gardens by the Bay, Sentosa and the Night Safari."),
    ("Bali Retreat", "Bali", "Indonesia", "Asia", "Beach", True, "IDR", True, -8.4095, 115.1889, 59999, 6, "bali,temple", "Ubud rice terraces, Uluwatu temple and beach evenings."),
    ("Maldives Retreat", "Maldives", "Maldives", "Asia", "Beach", True, "USD", False, 4.1755, 73.5093, 89999, 5, MALDIVES, "Overwater villa, snorkelling and speedboat transfers."),
    ("Nepal Himalaya", "Kathmandu and Pokhara", "Nepal", "Asia", "Adventure", True, "NPR", False, 27.7172, 85.3240, 27999, 5, "kathmandu,nepal", "Pashupatinath, Pokhara lake and Sarangkot sunrise."),
    ("Magical Paris", "Paris", "France", "Europe", "City", True, "EUR", True, 48.8566, 2.3522, 129999, 7, EIFFEL, "Eiffel Tower, the Louvre and a Seine cruise with daily breakfast."),
    ("Swiss Alps", "Interlaken and Lucerne", "Switzerland", "Europe", "Adventure", True, "CHF", True, 46.6863, 7.8632, 189999, 7, "switzerland,alps", "Jungfraujoch excursion, Lake Lucerne cruise and scenic trains."),
    ("London Classic", "London", "United Kingdom", "Europe", "City", True, "GBP", True, 51.5072, -0.1276, 159999, 7, "london,bridge", "Tower Bridge, Buckingham Palace, West End and a Windsor day trip."),
    ("Japan Discovery", "Tokyo and Kyoto", "Japan", "Asia", "City", True, "JPY", True, 35.6762, 139.6503, 139999, 7, "tokyo,tower", "Shibuya, Asakusa, a Mount Fuji day tour and Kyoto temples."),
    ("Umrah Package", "Makkah and Madinah", "Saudi Arabia", "Asia", "Religious", True, "SAR", True, 21.3891, 39.8579, 125000, 12, "mecca,kaaba", "Stay near the Haram with guided Ziyarat. Umrah only; Hajj is allotted by the Haj Committee of India."),
    ("New York City", "New York", "United States", "North America", "City", True, "USD", True, 40.7128, -74.0060, 219999, 7, "newyork,skyline", "Statue of Liberty, Times Square, Central Park and a Broadway night."),
    ("Sydney and Gold Coast", "Sydney", "Australia", "Oceania", "City", True, "AUD", True, -33.8688, 151.2093, 189999, 8, "sydney,opera", "Opera House, harbour cruise, Blue Mountains and Gold Coast beaches."),
]

ALL_AMENITIES = [
    "Free Wi-Fi", "Swimming pool", "Spa and wellness", "Fitness centre", "Fine-dining restaurant",
    "24x7 room service", "Concierge", "Airport transfer", "Valet parking", "Business centre",
    "Bar and lounge", "Kids club", "Laundry service", "Butler service", "Banquet hall",
]

# name, city, country, lat, lng, base price per night (INR), nearest airport, km to airport
HOTELS = [
    ("TripNest Grand Bengaluru", "Bengaluru", "India", 12.9716, 77.5946, 9500, "Kempegowda International (BLR)", 36),
    ("Rajmahal Heritage Palace", "Jaipur", "India", 26.9124, 75.7873, 14000, "Jaipur International (JAI)", 12),
    ("Goa Sands Beach Resort and Spa", "Goa", "India", 15.4909, 73.8278, 12500, "Dabolim (GOI)", 28),
    ("Yamuna View Palace", "Agra", "India", 27.1751, 78.0421, 11000, "Agra (AGR)", 10),
    ("Gateway Grand Mumbai", "Mumbai", "India", 18.9220, 72.8347, 16000, "Chhatrapati Shivaji (BOM)", 25),
    ("Imperial Capital Delhi", "New Delhi", "India", 28.6139, 77.2090, 13500, "Indira Gandhi International (DEL)", 16),
    ("Marina Skyline Tower", "Dubai", "United Arab Emirates", 25.2048, 55.2708, 22000, "Dubai International (DXB)", 24),
    ("Haram View Hotel", "Makkah", "Saudi Arabia", 21.4225, 39.8262, 18000, "King Abdulaziz International (JED)", 90),
    ("Madinah Noor Hotel", "Madinah", "Saudi Arabia", 24.4672, 39.6111, 15000, "Prince Mohammad bin Abdulaziz (MED)", 18),
    ("Eiffel Prestige Paris", "Paris", "France", 48.8584, 2.2945, 32000, "Charles de Gaulle (CDG)", 35),
    ("Harbour Grand Singapore", "Singapore", "Singapore", 1.2834, 103.8607, 28000, "Changi (SIN)", 20),
    ("Coral Overwater Resort", "Maldives", "Maldives", 4.1755, 73.5093, 55000, "Velana International (MLE)", 8),
]

ROOMS = [  # name, bed, sqm, guests, price multiplier, breakfast, refundable, count, features
    ("Deluxe Room", "King or twin bed", 38, 2, 1.0, True, True, 12, "City view,Rain shower,Smart TV,Mini bar,Work desk"),
    ("Executive Suite", "King bed", 68, 3, 1.7, True, True, 6, "Separate living area,Club lounge access,Bathtub,Nespresso machine,Evening cocktails"),
    ("Presidential Suite", "Super king bed", 140, 4, 3.4, True, False, 2, "Private butler,Dining room,Jacuzzi,Panoramic view,Airport limousine"),
]

PLACES = [  # kind, name, code, city, country, lat, lng
    ("airport", "Kempegowda International Airport", "BLR", "Bengaluru", "India", 13.1986, 77.7066),
    ("airport", "Indira Gandhi International Airport", "DEL", "New Delhi", "India", 28.5562, 77.1000),
    ("airport", "Chhatrapati Shivaji Maharaj International Airport", "BOM", "Mumbai", "India", 19.0896, 72.8656),
    ("airport", "Chennai International Airport", "MAA", "Chennai", "India", 12.9941, 80.1709),
    ("airport", "Rajiv Gandhi International Airport", "HYD", "Hyderabad", "India", 17.2403, 78.4294),
    ("airport", "Netaji Subhas Chandra Bose International Airport", "CCU", "Kolkata", "India", 22.6547, 88.4467),
    ("airport", "Dabolim Airport", "GOI", "Goa", "India", 15.3808, 73.8314),
    ("airport", "Cochin International Airport", "COK", "Kochi", "India", 10.1520, 76.4019),
    ("airport", "Jaipur International Airport", "JAI", "Jaipur", "India", 26.8242, 75.8122),
    ("airport", "Dubai International Airport", "DXB", "Dubai", "United Arab Emirates", 25.2532, 55.3657),
    ("airport", "King Abdulaziz International Airport", "JED", "Jeddah", "Saudi Arabia", 21.6796, 39.1565),
    ("airport", "Prince Mohammad bin Abdulaziz Airport", "MED", "Madinah", "Saudi Arabia", 24.5534, 39.7051),
    ("airport", "Singapore Changi Airport", "SIN", "Singapore", "Singapore", 1.3644, 103.9915),
    ("airport", "Charles de Gaulle Airport", "CDG", "Paris", "France", 49.0097, 2.5479),
    ("railway", "Bengaluru City Junction (KSR)", "SBC", "Bengaluru", "India", 12.9784, 77.5692),
    ("railway", "New Delhi Railway Station", "NDLS", "New Delhi", "India", 28.6419, 77.2194),
    ("railway", "Mumbai CSMT", "CSMT", "Mumbai", "India", 18.9398, 72.8355),
    ("railway", "Chennai Central", "MAS", "Chennai", "India", 13.0827, 80.2757),
    ("railway", "Howrah Junction", "HWH", "Kolkata", "India", 22.5839, 88.3425),
    ("railway", "Agra Cantt", "AGC", "Agra", "India", 27.1584, 77.9903),
    ("railway", "Jaipur Junction", "JP", "Jaipur", "India", 26.9197, 75.7885),
    ("railway", "Varanasi Junction", "BSB", "Varanasi", "India", 25.3270, 82.9870),
]

# email, name, phone, city, lat, lng, category, model, plate, color, seats, aadhaar4, pan4, licence4
DRIVERS = [
    ("driver1@tripnest.com", "Ramesh Kumar", "+919810000001", "Bengaluru", 13.2200, 77.7500, "sedan", "Toyota Etios", "KA01 AB 1234", "White", 4, "4821", "234F", "5678"),
    ("driver2@tripnest.com", "Imran Sheikh", "+919810000002", "Bengaluru", 13.1500, 77.6500, "suv", "Toyota Innova Crysta", "KA05 MN 2210", "Silver", 6, "7712", "908K", "4411"),
    ("driver3@tripnest.com", "Suresh Gowda", "+919810000003", "Bengaluru", 13.2500, 77.7200, "luxury", "Mercedes-Benz E-Class", "KA03 LX 7007", "Black", 4, "3390", "551B", "9021"),
    ("driver4@tripnest.com", "Abdul Rahman", "+919810000004", "Bengaluru", 13.1000, 77.6000, "tempo", "Force Traveller", "KA02 TT 4545", "White", 12, "6604", "172C", "3350"),
    ("driver5@tripnest.com", "Mohan Singh", "+919810000005", "Bengaluru", 13.0500, 77.5500, "hatchback", "Maruti Swift Dzire", "KA04 HB 9090", "Grey", 4, "5108", "463D", "1272"),
]


def seed(db: Session) -> None:
    def add_user(email, name, role, password, phone=None):
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            user = User(name=name, email=email, role=role, password_hash=hash_password(password), phone=phone)
            db.add(user)
            db.flush()
        return user

    if config.SEED_DEMO_LOGINS:
        add_user("admin@tripnest.com", "MD AFFAN ANWAR", "admin", "Admin@123")
        add_user("customer@tripnest.com", "Demo Traveller", "customer", "Customer@123")
    # On a public deployment the seeded drivers get random passwords nobody knows, so they only serve rides.
    driver_password = "Driver@123" if config.SEED_DEMO_LOGINS else secrets.token_urlsafe(24)

    for email, name, phone, city, lat, lng, cat, model, plate, color, seats, a4, p4, l4 in DRIVERS:
        user = add_user(email, name, "driver", driver_password)
        if not db.scalar(select(Driver).where(Driver.user_id == user.id)):
            driver = Driver(
                user_id=user.id, full_name=name, phone=phone, city=city, aadhaar_last4=a4, pan_last4=p4,
                licence_last4=l4, licence_expiry=date.today() + timedelta(days=900), kyc_status="approved",
                is_online=True, lat=lat, lng=lng, last_seen=datetime.now(timezone.utc),
                rating=round(4.6 + (seats % 4) / 10, 1), total_trips=120 + seats * 7,
            )
            driver.vehicle = Vehicle(category=cat, make_model=model, plate_number=plate, color=color, seats=seats)
            db.add(driver)

    if not db.scalar(select(Package)):
        for i, (title, dest, country, cont, cat, intl, cur, visa, lat, lon, price, days, image, desc) in enumerate(PACKAGES):
            db.add(Package(
                title=title, destination=dest, country=country, continent=cont, category=cat, is_international=intl,
                currency=cur, visa_required=visa, latitude=lat, longitude=lon, price=price, duration_days=days,
                seats=20, image_url=img(image, i + 1), description=desc,
            ))

    if not db.scalar(select(Hotel)):
        for i, (name, city, country, lat, lng, base, airport, km) in enumerate(HOTELS):
            amenities = ALL_AMENITIES if i % 3 == 0 else [a for j, a in enumerate(ALL_AMENITIES) if j != 9 + i % 4]
            images = "|".join(img(k, 100 + i * 10 + n, 900, 600) for n, k in enumerate(
                ["luxury,hotel,lobby", "hotel,suite,bedroom", "hotel,swimming,pool", "hotel,restaurant,dining"]))
            hotel = Hotel(
                name=name, city=city, country=country, address=f"City centre, {city}, {country}", star_rating=5,
                description=f"A five-star address in {city} with spacious rooms, signature dining, a full-service spa "
                            f"and a 24-hour concierge. Demo property with indicative prices.",
                latitude=lat, longitude=lng, rating=round(4.4 + (i % 6) / 10, 1), reviews_count=800 + i * 137,
                amenities=",".join(amenities), images=images, nearest_airport=airport, airport_distance_km=km,
                cancellation_policy="Free cancellation up to 48 hours before check-in on refundable rooms. "
                                    "Non-refundable rooms are charged in full. Early check-in and late checkout on request.",
            )
            for name_r, bed, sqm, guests, mult, brk, ref, count, feats in ROOMS:
                hotel.rooms.append(RoomType(
                    name=name_r, bed_type=bed, size_sqm=sqm, max_guests=guests, price_per_night=round(base * mult),
                    breakfast_included=brk, refundable=ref, rooms_available=count, features=feats,
                    image_url=img("hotel,room", 300 + i * 3 + len(hotel.rooms), 700, 450),
                ))
            db.add(hotel)

    if not db.scalar(select(Place)):
        for kind, name, code, city, country, lat, lng in PLACES:
            db.add(Place(kind=kind, name=name, code=code, city=city, country=country, lat=lat, lng=lng))

    if not db.scalar(select(Offer)):
        until = date.today() + timedelta(days=365)
        for code, title, desc, pct, cap, minimum, applies in [
            ("WELCOME10", "Welcome offer", "10% off on trips and stays, up to Rs. 5,000", 10, 5000, 10000, "all"),
            ("INTL15", "International saver", "15% off international trips above Rs. 50,000, up to Rs. 15,000", 15, 15000, 50000, "international"),
            ("INDIA8", "Incredible India", "8% off trips within India, up to Rs. 3,000", 8, 3000, 5000, "domestic"),
            ("STAY12", "Luxury stay", "12% off hotel stays above Rs. 20,000, up to Rs. 8,000", 12, 8000, 20000, "stay"),
        ]:
            db.add(Offer(code=code, title=title, description=desc, discount_percent=pct, max_discount=cap,
                         min_amount=minimum, applies_to=applies, valid_until=until))
    db.commit()
