import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import HotelCard from "../components/HotelCard";

const AMENITIES = ["Swimming pool", "Spa", "Airport transfer", "Fine-dining", "Butler", "Kids club", "Fitness"];

export default function Hotels() {
  const [params0] = useSearchParams();
  const [hotels, setHotels] = useState([]);
  const [filters, setFilters] = useState({ q: params0.get("q") || "", stars: "", max_price: "", amenity: "", sort: params0.get("sort") || "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
        setHotels(await api(`/hotels?${params}`));
      } catch (err) { setError(err.message); } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  return (
    <>
      <h1>Five-star hotels</h1>
      <p className="muted">Spacious rooms, signature dining, spa and 24-hour concierge. Add an airport pickup to any stay.</p>
      <div className="panel">
        <div className="filters">
          <input placeholder="City, country or hotel" value={filters.q} onChange={set("q")} aria-label="Search hotels" />
          <input type="number" min="0" placeholder="Max price per night" value={filters.max_price} onChange={set("max_price")} aria-label="Maximum price per night" />
          <select value={filters.amenity} onChange={set("amenity")} aria-label="Amenity">
            <option value="">Any amenity</option>
            {AMENITIES.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select value={filters.sort} onChange={set("sort")} aria-label="Sort">
            <option value="">Recommended</option>
            <option value="rating">Top rated</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
      </div>
      {loading && <p className="center muted">Loading hotels...</p>}
      {error && <p className="error center">{error}</p>}
      {!loading && !error && hotels.length === 0 && <p className="center muted">No hotels match these filters.</p>}
      <section className="grid">{hotels.map((h) => <HotelCard key={h.id} hotel={h} />)}</section>
      <p className="muted small center" style={{ marginTop: 18 }}>Demo properties with indicative prices per room per night.</p>
    </>
  );
}
