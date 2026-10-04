import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import LiveMap from "../components/LiveMap";
import { inr, kmBetween, label, when } from "../format";

const STEPS = ["requested", "accepted", "arrived", "in_trip", "completed"];
const HEADLINE = {
  requested: "Looking for a driver near your pickup",
  accepted: "Your driver is on the way",
  arrived: "Your driver has arrived",
  in_trip: "You are on your way",
  completed: "Trip completed",
  cancelled: "Ride cancelled",
};

export default function Track() {
  const { id } = useParams();
  const [ride, setRide] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const statusRef = useRef("");
  const load = useCallback(
    () => api(`/transfers/${id}`).then((r) => { statusRef.current = r.status; setRide(r); }).catch((e) => setError(e.message)),
    [id],
  );

  // Live tracking: poll every 4 seconds while the ride is active (WebSockets would be the next step).
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!["completed", "cancelled"].includes(statusRef.current)) load();
    }, 4000);
    return () => clearInterval(timer);
  }, [load]);

  const call = async (path) => {
    setBusy(true);
    setError("");
    try { setRide(await api(path, { method: "POST" })); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const pay = async () => {
    setBusy(true);
    try { await api(`/pay/transfer/${id}`, { method: "POST" }); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (error && !ride) return <p className="error center">{error}</p>;
  if (!ride) return <p className="center muted">Loading ride...</p>;

  const d = ride.driver;
  const target = ride.status === "in_trip" ? { lat: ride.drop_lat, lng: ride.drop_lng } : { lat: ride.pickup_lat, lng: ride.pickup_lng };
  const km = d?.lat != null ? kmBetween(d.lat, d.lng, target.lat, target.lng) : null;
  const eta = km != null && ["accepted", "in_trip"].includes(ride.status) ? Math.max(1, Math.ceil((km / 30) * 60)) : null;
  const stepIndex = STEPS.indexOf(ride.status);
  const active = !["completed", "cancelled"].includes(ride.status);

  return (
    <div className="details">
      <div>
        <h1>{HEADLINE[ride.status]}</h1>
        {eta && <p className="muted">About {eta} min away ({km.toFixed(1)} km)</p>}
        {ride.status !== "cancelled" && (
          <div className="timeline" aria-label="Ride progress">
            {STEPS.map((s, i) => <div key={s} className={`step ${i <= stepIndex ? "done" : ""}`}>{label(s)}</div>)}
          </div>
        )}
        <LiveMap
          pickup={{ lat: ride.pickup_lat, lng: ride.pickup_lng, name: ride.pickup_name }}
          drop={{ lat: ride.drop_lat, lng: ride.drop_lng, name: ride.drop_name }}
          driver={d}
          height={400}
        />
        <p className="muted small" style={{ marginTop: 8 }}>
          Map data from OpenStreetMap. The car moves as the driver app sends its GPS position.
        </p>
      </div>

      <div className="stack">
        <div className="panel">
          <h3>Trip details</h3>
          <p><span className="badge">{label(ride.status)}</span> <span className={`badge ${ride.payment_status}`}>{ride.payment_status}</span></p>
          <p><strong>From</strong> {ride.pickup_name}<br /><strong>To</strong> {ride.drop_name}</p>
          <p className="muted small">{when(ride.pickup_time)} - {ride.distance_km} km - {ride.passengers} passenger(s) - {label(ride.vehicle_category)}</p>
          {ride.flight_or_train && <p className="small">Flight or train: {ride.flight_or_train}</p>}
          <p className="price">{inr(ride.fare)}</p>
          {ride.ride_otp && ["accepted", "arrived"].includes(ride.status) && (
            <div className="info">Share this OTP with your driver to start the trip<div className="otp">{ride.ride_otp}</div></div>
          )}
        </div>

        {d && (
          <div className="panel">
            <h3>Your driver</h3>
            <p><strong>{d.full_name}</strong> - rated {d.rating} ({d.total_trips} trips)</p>
            {d.vehicle && <p>{d.vehicle.make_model}, {d.vehicle.color}<br /><strong>{d.vehicle.plate_number}</strong></p>}
            {d.phone && <a className="btn btn-secondary btn-sm" href={`tel:${d.phone}`}>Call driver</a>}
          </div>
        )}

        {error && <p className="error">{error}</p>}
        {active && ["requested", "accepted", "arrived"].includes(ride.status) && (
          <button className="btn btn-danger" disabled={busy} onClick={() => call(`/transfers/${id}/cancel`)}>Cancel ride</button>
        )}
        {ride.payment_status === "unpaid" && ride.status !== "cancelled" && (
          <button className="btn btn-success" disabled={busy} onClick={pay}>Pay {inr(ride.fare)} (demo)</button>
        )}
        {active && (
          <div className="warn-box">
            <strong>Demo mode:</strong> no driver app is open, so use this button to move the ride forward one step
            (driver accepts, drives, arrives, trip starts, trip ends).
            <button className="btn btn-accent btn-sm full" style={{ marginTop: 8 }} disabled={busy} onClick={() => call(`/transfers/${id}/demo-step`)}>
              Simulate next driver step
            </button>
          </div>
        )}
        <Link to="/my-trips?tab=rides" className="small">Back to my bookings</Link>
      </div>
    </div>
  );
}
