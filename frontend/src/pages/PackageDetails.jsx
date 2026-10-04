import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import PassengerForm, { cleanPassengers } from "../components/PassengerForm";
import SafeImg from "../components/SafeImg";
import { inr, tomorrow } from "../format";

const weatherText = (c) =>
  c === 0 ? "Clear sky" : c <= 3 ? "Partly cloudy" : c <= 48 ? "Foggy" : c <= 57 ? "Drizzle" : c <= 67 ? "Rain"
    : c <= 77 ? "Snow" : c <= 82 ? "Rain showers" : c <= 86 ? "Snow showers" : "Thunderstorm";

// Live weather (Open-Meteo) and exchange rates (open.er-api.com): both free, no API key.
function LiveInfo({ pkg, count, preferred }) {
  const [weather, setWeather] = useState(null);
  const [rates, setRates] = useState(null);

  useEffect(() => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pkg.latitude}&longitude=${pkg.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`)
      .then((r) => r.json()).then((d) => setWeather(d.current)).catch(() => {});
    fetch("https://open.er-api.com/v6/latest/INR").then((r) => r.json()).then((d) => setRates(d.rates)).catch(() => {});
  }, [pkg.latitude, pkg.longitude]);

  const money = (code) => rates?.[code] ? `${Math.round(Number(pkg.price) * rates[code]).toLocaleString()} ${code}` : null;
  const shown = [...new Set([pkg.currency, preferred])].filter((c) => c && c !== "INR").map(money).filter(Boolean);
  if (!weather && shown.length === 0) return null;
  return (
    <div className="info">
      {weather && <div>Now in {pkg.destination}: <strong>{Math.round(weather.temperature_2m)} °C</strong>, {weatherText(weather.weather_code)}, wind {Math.round(weather.wind_speed_10m)} km/h</div>}
      {shown.length > 0 && <div>Per person, approximately {shown.join(" or ")} (live exchange rate)</div>}
    </div>
  );
}

export default function PackageDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState(null);
  const [travelers, setTravelers] = useState(1);
  const [date, setDate] = useState("");
  const [people, setPeople] = useState([]);
  const [saved, setSaved] = useState([]);
  const [code, setCode] = useState("");
  const [offer, setOffer] = useState(null);
  const [offerError, setOfferError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api(`/packages/${id}`).then(setPkg).catch((e) => setError(e.message)); }, [id]);
  useEffect(() => {
    if (user?.role === "customer") api("/me/passengers").then(setSaved).catch(() => {});
  }, [user]);

  if (error && !pkg) return <p className="error center">{error}</p>;
  if (!pkg) return <p className="center muted">Loading...</p>;

  const count = Math.max(1, Math.min(10, Number(travelers) || 1));
  const subtotal = Number(pkg.price) * count;
  const discount = offer ? offer.discount : 0;
  const need = pkg.is_international
    ? `Passport${pkg.visa_required ? ", visa" : ""} and a selfie`
    : "Aadhaar, PAN or driving licence, plus a selfie";

  const applyOffer = async () => {
    setOffer(null);
    setOfferError("");
    if (!code.trim()) return;
    try {
      setOffer(await api("/offers/check", { method: "POST", body: { code, kind: "trip", amount: subtotal, international: pkg.is_international } }));
    } catch (err) { setOfferError(err.message); }
  };

  const book = async (e) => {
    e.preventDefault();
    if (!user) return navigate("/login");
    setError("");
    setBusy(true);
    try {
      await api("/bookings", {
        method: "POST",
        body: { package_id: pkg.id, travelers: count, travel_date: date, offer_code: offer ? offer.code : null, passengers: cleanPassengers(people.slice(0, count)) },
      });
      navigate("/my-trips");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="details">
      <div>
        <SafeImg className="card-img" src={pkg.image_url} alt={pkg.title} />
        <div style={{ marginTop: 14 }}>
          <span className="chip">{pkg.destination}</span>
          {pkg.is_international && <span className="chip intl">International</span>}
        </div>
        <h1>{pkg.title}</h1>
        <p className="muted">{pkg.country} - {pkg.category} - {pkg.duration_days} days - {pkg.seats} seats left</p>
        <p>{pkg.description}</p>
        <LiveInfo pkg={pkg} count={count} preferred={user?.currency} />
        <div className="warn-box">Verification needed to book: {need}. <Link to="/account?tab=verification">Upload documents</Link></div>
      </div>

      <form className="panel sticky" onSubmit={book}>
        <h3>Book this trip</h3>
        <label>Travellers
          <input type="number" min="1" max="10" value={travelers} onChange={(e) => { setTravelers(e.target.value); setOffer(null); }} required />
        </label>
        <label>Travel date
          <input type="date" min={tomorrow()} value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <p className="small"><strong>Passenger details</strong></p>
        <PassengerForm count={count} value={people} onChange={setPeople} saved={saved} />
        <label>Offer code
          <div style={{ display: "flex", gap: 8 }}>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" />
            <button type="button" className="btn btn-secondary" onClick={applyOffer}>Apply</button>
          </div>
        </label>
        {offer && <p className="success small">{offer.code} applied: {offer.message}</p>}
        {offerError && <p className="error small">{offerError}</p>}
        <div className="lines">
          <div><span>{count} x {inr(pkg.price)}</span><span>{inr(subtotal)}</span></div>
          {discount > 0 && <div className="save"><span>Offer discount</span><span>- {inr(discount)}</span></div>}
          <div className="total"><span>Total</span><span>{inr(subtotal - discount)}</span></div>
        </div>
        {error && <p className="error">{error} {error.startsWith("Verification required") && <Link to="/account?tab=verification">Verify now</Link>}</p>}
        <button className="btn btn-primary full" disabled={busy || pkg.seats === 0}>
          {pkg.seats === 0 ? "Sold out" : busy ? "Booking..." : user ? "Book now" : "Log in to book"}
        </button>
      </form>
    </div>
  );
}
