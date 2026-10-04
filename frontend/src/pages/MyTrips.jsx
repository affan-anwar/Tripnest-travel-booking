import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import SafeImg from "../components/SafeImg";
import { day, inr, label, when } from "../format";

export default function MyTrips() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "trips";
  const [data, setData] = useState({ trips: [], stays: [], rides: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [trips, stays, rides] = await Promise.all([api("/bookings/mine"), api("/hotels/stays/mine"), api("/transfers/mine")]);
      setData({ trips, stays, rides });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (path) => {
    setError("");
    try { await api(path, { method: "POST" }); await load(); } catch (err) { setError(err.message); }
  };
  const cancel = (path) => window.confirm("Cancel this booking?") && act(path);

  if (loading) return <p className="center muted">Loading...</p>;
  const empty = (text, to, cta) => <p className="muted">{text} <Link to={to}>{cta}</Link></p>;

  return (
    <>
      <h1>My bookings</h1>
      <div className="tabs" role="tablist">
        {[["trips", "Trips"], ["stays", "Hotel stays"], ["rides", "Airport and station rides"]].map(([key, text]) => (
          <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setParams({ tab: key })}>
            {text} ({data[key].length})
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}

      {tab === "trips" && (
        <div className="list">
          {data.trips.length === 0 && empty("No trips yet.", "/", "Explore trips")}
          {data.trips.map((b) => (
            <div className="item" key={b.id}>
              <SafeImg className="thumb" src={b.package.image_url} alt={b.package.title} />
              <div className="grow">
                <h3>{b.package.title}</h3>
                <p className="muted small">{day(b.travel_date)} - {b.travelers} traveller(s){b.offer_code ? ` - saved ${inr(b.discount)} with ${b.offer_code}` : ""}</p>
                <p className="small">{b.passengers.map((p) => p.name).join(", ")}</p>
              </div>
              <strong>{inr(b.total_price)}</strong>
              <span className={`badge ${b.status}`}>{label(b.status)}</span>
              <span className={`badge ${b.payment_status}`}>{b.payment_status}</span>
              {b.status === "pending_verification" && <Link to="/account?tab=verification" className="small">Complete verification</Link>}
              {b.status !== "cancelled" && b.payment_status === "unpaid" && <button className="btn btn-success btn-sm" onClick={() => act(`/pay/booking/${b.id}`)}>Pay (demo)</button>}
              {b.status !== "cancelled" && <button className="btn btn-danger btn-sm" onClick={() => cancel(`/bookings/${b.id}/cancel`)}>Cancel</button>}
            </div>
          ))}
        </div>
      )}

      {tab === "stays" && (
        <div className="list">
          {data.stays.length === 0 && empty("No hotel stays yet.", "/hotels", "Find a hotel")}
          {data.stays.map((s) => (
            <div className="item" key={s.id}>
              <SafeImg className="thumb" src={s.hotel.images[0]} alt={s.hotel.name} />
              <div className="grow">
                <h3>{s.hotel.name}</h3>
                <p className="muted small">{s.room_type.name} - {day(s.check_in)} to {day(s.check_out)} ({s.nights} nights) - {s.rooms} room(s), {s.guests} guest(s)</p>
                {s.addons.length > 0 && <p className="small">Add-ons: {s.addons.map(label).join(", ")}</p>}
                {s.special_requests && <p className="small muted">Request: {s.special_requests}</p>}
              </div>
              <strong>{inr(s.total_price)}</strong>
              <span className={`badge ${s.status}`}>{s.status}</span>
              <span className={`badge ${s.payment_status}`}>{s.payment_status}</span>
              {s.status !== "cancelled" && s.payment_status === "unpaid" && <button className="btn btn-success btn-sm" onClick={() => act(`/pay/stay/${s.id}`)}>Pay (demo)</button>}
              {s.status !== "cancelled" && <button className="btn btn-danger btn-sm" onClick={() => cancel(`/hotels/stays/${s.id}/cancel`)}>Cancel</button>}
            </div>
          ))}
        </div>
      )}

      {tab === "rides" && (
        <div className="list">
          {data.rides.length === 0 && empty("No rides yet.", "/transfers", "Book an airport or station ride")}
          {data.rides.map((r) => (
            <div className="item" key={r.id}>
              <div className="grow">
                <h3>{r.pickup_name} to {r.drop_name}</h3>
                <p className="muted small">{when(r.pickup_time)} - {r.distance_km} km - {label(r.vehicle_category)}{r.driver ? ` - driver ${r.driver.full_name}` : ""}</p>
              </div>
              <strong>{inr(r.fare)}</strong>
              <span className={`badge ${r.status}`}>{label(r.status)}</span>
              <Link className="btn btn-primary btn-sm" to={`/track/${r.id}`}>{["completed", "cancelled"].includes(r.status) ? "Details" : "Track live"}</Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
