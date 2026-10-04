import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import HotelCard from "../components/HotelCard";
import Icon from "../components/Icon";
import HeroSearch from "../components/HeroSearch";
import PackageCard from "../components/PackageCard";
import { resolveImage } from "../images";

const CONTINENTS = ["Asia", "Europe", "Africa", "North America", "South America", "Oceania"];
const CATEGORIES = ["Beach", "City", "Heritage", "Adventure", "Religious"];
const FEATURES = [
  ["shield", "Verified drivers", "Every driver submits Aadhaar, PAN, licence and a selfie, and is approved by an admin before going online."],
  ["car", "Live tracking", "Follow your pickup car on the map from the moment the driver accepts."],
  ["bed", "Five-star stays", "Rooms, suites, dining, spa and airport pickup, all in one booking."],
  ["globe", "Worldwide trips", "Packages across India and the world, including Umrah to Makkah and Madinah."],
];

export default function Home() {
  const [packages, setPackages] = useState([]);
  const [offers, setOffers] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [hero, setHero] = useState("");
  const [filters, setFilters] = useState({ q: "", max_price: "", region: "", continent: "", category: "", sort: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const tripsRef = useRef(null);

  useEffect(() => {
    api("/offers").then(setOffers).catch(() => {});
    api("/hotels?sort=rating").then((h) => setHotels(h.slice(0, 3))).catch(() => {});
    resolveImage("hero:home").then((u) => u && setHero(u));
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
        setPackages(await api(`/packages?${params}`));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });
  const copy = (code) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
  };
  const searchTrips = ({ q, region }) => {
    setFilters((f) => ({ ...f, q, region }));
    tripsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <section className="home-hero" style={hero ? { backgroundImage: `url(${hero})` } : undefined}>
        <div className="home-hero-inner">
          <span className="eyebrow">TripNest</span>
          <h1>Five-star stays and journeys, door to door</h1>
          <p>Book trips across India and the world, stay in luxury hotels, and get picked up from the airport or railway station by a verified driver you can track live.</p>
          <div className="quick">
            <Link className="btn btn-accent" to="/hotels">Browse hotels</Link>
            <Link className="btn btn-ghost" to="/transfers">Book an airport ride</Link>
          </div>
        </div>
      </section>

      <div className="booking-wrap"><HeroSearch onTrips={searchTrips} /></div>

      {offers.length > 0 && (
        <section className="section" aria-label="Offers">
          <div className="section-head"><div><h2>Offers for you</h2><p>Tap a code to copy it, then apply it at checkout.</p></div></div>
          <div className="offers">
            {offers.map((o) => (
              <button key={o.id} className="offer" onClick={() => copy(o.code)} title="Copy code">
                <strong>{o.code}</strong>
                <span className="small">{o.description}</span>
                <br />
                <span className="small muted">{copied === o.code ? "Copied" : "Tap to copy"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="features">
          {FEATURES.map(([icon, title, text]) => (
            <div className="feature" key={title}>
              <Icon name={icon} size={26} />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {hotels.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div><h2>Top-rated hotels</h2><p>Sample listings with indicative prices per night.</p></div>
            <Link className="btn btn-outline btn-sm" to="/hotels">See all hotels</Link>
          </div>
          <div className="grid">{hotels.map((h) => <HotelCard key={h.id} hotel={h} />)}</div>
        </section>
      )}

      <section className="section" id="trips" ref={tripsRef}>
        <div className="section-head"><div><h2>Trip packages</h2><p>Across India and the world.</p></div></div>
        <div className="panel">
          <div className="filters" style={{ marginTop: 0 }}>
            <input placeholder="Search city, country or trip" value={filters.q} onChange={set("q")} aria-label="Search" />
            <input type="number" min="0" placeholder="Max price (Rs.)" value={filters.max_price} onChange={set("max_price")} aria-label="Maximum price" />
            <select value={filters.region} onChange={set("region")} aria-label="Region">
              <option value="">India and world</option>
              <option value="domestic">India only</option>
              <option value="international">International</option>
            </select>
            <select value={filters.continent} onChange={set("continent")} aria-label="Continent">
              <option value="">All continents</option>
              {CONTINENTS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={filters.category} onChange={set("category")} aria-label="Category">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={filters.sort} onChange={set("sort")} aria-label="Sort">
              <option value="">Recommended</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="days">Shortest trips</option>
            </select>
          </div>
        </div>
        {loading && <p className="center muted">Loading trips...</p>}
        {error && <p className="error center">{error}</p>}
        {!loading && !error && packages.length === 0 && <p className="center muted">No trips match these filters. Clear a filter to see more.</p>}
        <div className="grid">{packages.map((p) => <PackageCard key={p.id} pkg={p} />)}</div>
        <p className="muted small center" style={{ marginTop: 22 }}>
          Prices are indicative starting prices per person (twin sharing, excluding flights and visa fees) and are confirmed at booking.
        </p>
      </section>
    </>
  );
}
