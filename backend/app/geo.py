import math

# Fare table: base fare + per-km rate (INR). Road distance ~ 1.3 x straight line.
VEHICLES = {
    "hatchback": {"label": "Hatchback", "seats": 4, "base": 99, "per_km": 12},
    "sedan": {"label": "Sedan", "seats": 4, "base": 149, "per_km": 15},
    "suv": {"label": "SUV", "seats": 6, "base": 249, "per_km": 20},
    "luxury": {"label": "Luxury sedan", "seats": 4, "base": 499, "per_km": 35},
    "tempo": {"label": "Tempo Traveller", "seats": 12, "base": 399, "per_km": 25},
}
ROAD_FACTOR = 1.3


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def road_distance_km(lat1, lng1, lat2, lng2) -> float:
    return round(haversine_km(lat1, lng1, lat2, lng2) * ROAD_FACTOR, 1)


def fare_for(category: str, distance_km: float) -> int:
    v = VEHICLES[category]
    return round(v["base"] + v["per_km"] * distance_km)
