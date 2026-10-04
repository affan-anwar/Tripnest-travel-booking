import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { inr, kmBetween } from "../format";

const nextMorning = () => {
  const d = new Date(Date.now() + 86400000);
  d.setHours(10, 0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function Transfers() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [places, setPlaces] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [quote, setQuote] = useState(null);
  const [form, setForm] = useState({ time: nextMorning(), passengers: 1, luggage: 1, flight: "", notes: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api("/transfers/places"), api("/hotels")]).then(([p, h]) => {
      setPlaces(p);
      setHotels(h);
      const hotelId = params.get("hotel");
      const hotel = h.find((x) => String(x.id) === hotelId);
      if (hotel) {
        setTo(`h:${hotel.id}`);
        // Suggest the airport that is nearest to the hotel.
        const near = [...p].filter((x) => x.kind === "airport")
          .sort((a, b) => kmBetween(a.lat, a.lng, hotel.latitude, hotel.longitude) - kmBetween(b.lat, b.lng, hotel.latitude, hotel.longitude))[0];
        if (near) setFrom(`p:${near.id}`);
      }
    }).catch((e) => setError(e.message));
  }, [params]);

  const locations = useMemo(() => {
    const map = {};
    places.forEach((p) => { map[`p:${p.id}`] = { name: `${p.name} (${p.code})`, lat: p.lat, lng: p.lng }; });
    hotels.forEach((h) => { map[`h:${h.id}`] = { name: h.name, lat: h.latitude, lng: h.longitude }; });
    return map;
  }, [places, hotels]);

  const a = locations[from];
  const b = locations[to];

  useEffect(() => {
    setQuote(null);
    if (!a || !b || from === to) return;
    api("/transfers/quote", { method: "POST", body: { pickup_lat: a.lat, pickup_lng: a.lng, drop_lat: b.lat, drop_lng: b.lng } })
      .then((q) => { setQuote(q); setVehicle((v) => v || "sedan"); })
      .catch((e) => setError(e.message));
  }, [from, to, a?.lat, b?.lat]);

  const optionsFor = (kinds) => (
    <>
      <optgroup label="Airports">{places.filter((p) => p.kind === "airport").map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name} ({p.code})</option>)}</optgroup>
      <optgroup label="Railway stations">{places.filter((p) => p.kind === "railway").map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}</optgroup>
      <optgroup label="Hotels">{hotels.map((h) => <option key={h.id} value={`h:${h.id}`}>{h.name}, {h.city}</option>)}</optgroup>
    </>
  );

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const ride = await api("/transfers", {
        method: "POST",
        body: {
          pickup_name: a.name, pickup_lat: a.lat, pickup_lng: a.lng, drop_name: b.name, drop_lat: b.lat, drop_lng: b.lng,
          pickup_time: new Date(form.time).toISOString(), passengers: Number(form.passengers), luggage: Number(form.luggage),
          vehicle_category: vehicle, flight_or_train: form.flight, notes: form.notes,
        },
      });
      navigate(`/track/${ride.id}`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const selected = quote?.options.find((o) => o.category === vehicle);

  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>Airport and railway station rides</h1>
      <p className="muted">A verified driver meets you at arrivals with your name and takes you to your hotel. Fixed fare, no surge.</p>
      <form className="panel" onSubmit={submit}>
        <div className="form-grid">
          <label>Pickup from
            <select value={from} onChange={(e) => setFrom(e.target.value)} required>
              <option value="">Choose a place</option>
              {optionsFor()}
            </select>
          </label>
          <label>Drop at
            <select value={to} onChange={(e) => setTo(e.target.value)} required>
              <option value="">Choose a place</option>
              {optionsFor()}
            </select>
          </label>
        </div>
        <button type="button" className="link-btn" onClick={() => { setFrom(to); setTo(from); }}>Swap pickup and drop</button>
        {from && from === to && <p className="error small">Pickup and drop must be different.</p>}

        {quote && (
          <>
            <p style={{ marginTop: 14 }}><strong>{quote.distance_km} km</strong> by road. Choose a vehicle:</p>
            <div className="vehicle-pick">
              {quote.options.map((o) => (
                <button type="button" key={o.category} className={`vehicle ${vehicle === o.category ? "selected" : ""}`} onClick={() => setVehicle(o.category)}>
                  <strong>{o.label}</strong>
                  <div className="muted small">Up to {o.seats} passengers</div>
                  <div className="price">{inr(o.fare)}</div>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="form-grid">
          <label>Pickup date and time<input type="datetime-local" value={form.time} onChange={set("time")} required /></label>
          <label>Flight or train number<input value={form.flight} onChange={set("flight")} placeholder="AI 507 or 12627" maxLength={30} /></label>
          <label>Passengers<input type="number" min="1" max="12" value={form.passengers} onChange={set("passengers")} required /></label>
          <label>Bags<input type="number" min="0" max="20" value={form.luggage} onChange={set("luggage")} /></label>
        </div>
        <label>Notes for the driver<textarea value={form.notes} onChange={set("notes")} maxLength={255} placeholder="Terminal, meeting point, child seat..." /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary full" disabled={busy || !quote || !vehicle}>
          {busy ? "Booking..." : selected ? `Book ride for ${inr(selected.fare)}` : "Book ride"}
        </button>
      </form>
    </div>
  );
}
