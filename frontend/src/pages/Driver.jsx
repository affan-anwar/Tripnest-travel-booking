import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import DocsManager, { DRIVER_GROUPS } from "../components/DocsManager";
import LiveMap from "../components/LiveMap";
import { day, inr, label, when } from "../format";

const CATEGORIES = [["hatchback", "Hatchback", 4], ["sedan", "Sedan", 4], ["suv", "SUV", 6], ["luxury", "Luxury sedan", 4], ["tempo", "Tempo Traveller", 12]];

function ProfileForms({ me, onSaved }) {
  const [pf, setPf] = useState({ full_name: "", phone: "", city: "", aadhaar: "", pan: "", licence: "", licence_expiry: "" });
  const [vf, setVf] = useState({ category: "sedan", make_model: "", plate_number: "", color: "White", seats: 4, ac: true });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPf({ full_name: me.full_name, phone: me.phone || "", city: me.city || "", aadhaar: "", pan: "", licence: "", licence_expiry: me.licence_expiry || "" });
    if (me.vehicle) setVf({ ...me.vehicle });
  }, [me.id]);

  const save = async (path, body, text) => {
    setMsg(""); setError("");
    try { onSaved(await api(path, { method: "PUT", body })); setMsg(text); } catch (err) { setError(err.message); }
  };
  const sp = (k) => (e) => setPf({ ...pf, [k]: e.target.value });
  const sv = (k) => (e) => setVf({ ...vf, [k]: e.target.value });

  return (
    <>
      <form className="panel" onSubmit={(e) => { e.preventDefault(); const body = { ...pf, licence_expiry: pf.licence_expiry || null }; ["aadhaar", "pan", "licence"].forEach((k) => !body[k] && delete body[k]); save("/driver/profile", body, "Profile saved"); }}>
        <h3>Personal and identity details</h3>
        <p className="muted small">
          Saved: Aadhaar ending {me.aadhaar_last4 || "-"}, PAN ending {me.pan_last4 || "-"}, licence ending {me.licence_last4 || "-"}.
          Enter a number only to add or change it. Only the last 4 characters are stored.
        </p>
        <div className="form-grid">
          <label>Full name<input value={pf.full_name} onChange={sp("full_name")} required /></label>
          <label>Mobile number<input value={pf.phone} onChange={sp("phone")} placeholder="+91 98765 43210" /></label>
          <label>City<input value={pf.city} onChange={sp("city")} /></label>
          <label>Aadhaar number<input value={pf.aadhaar} onChange={sp("aadhaar")} placeholder="12 digits" /></label>
          <label>PAN<input value={pf.pan} onChange={sp("pan")} placeholder="ABCDE1234F" /></label>
          <label>Driving licence number<input value={pf.licence} onChange={sp("licence")} placeholder="MH1220110012345" /></label>
          <label>Licence expiry<input type="date" value={pf.licence_expiry} onChange={sp("licence_expiry")} /></label>
        </div>
        <button className="btn btn-primary">Save details</button>
      </form>

      <form className="panel" onSubmit={(e) => { e.preventDefault(); save("/driver/vehicle", { ...vf, seats: Number(vf.seats) }, "Vehicle saved"); }}>
        <h3>Your vehicle</h3>
        <div className="form-grid">
          <label>Type
            <select value={vf.category} onChange={(e) => { const c = CATEGORIES.find((x) => x[0] === e.target.value); setVf({ ...vf, category: c[0], seats: c[2] }); }}>
              {CATEGORIES.map(([k, text]) => <option key={k} value={k}>{text}</option>)}
            </select>
          </label>
          <label>Make and model<input value={vf.make_model} onChange={sv("make_model")} required placeholder="Toyota Innova Crysta" /></label>
          <label>Number plate<input value={vf.plate_number} onChange={sv("plate_number")} required placeholder="KA01 AB 1234" /></label>
          <label>Colour<input value={vf.color} onChange={sv("color")} /></label>
          <label>Seats<input type="number" min="2" max="20" value={vf.seats} onChange={sv("seats")} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={vf.ac} onChange={(e) => setVf({ ...vf, ac: e.target.checked })} />Air conditioned</label>
        <button className="btn btn-primary">Save vehicle</button>
      </form>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}
    </>
  );
}

export default function Driver() {
  const [tab, setTab] = useState("rides");
  const [me, setMe] = useState(null);
  const [requests, setRequests] = useState([]);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState({ count: 0, earnings: 0, trips: [] });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [gps, setGps] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const simRef = useRef(null);
  const watchRef = useRef(null);

  const loadMe = useCallback(() => api("/driver/me").then(setMe).catch((e) => setError(e.message)), []);
  const loadRides = useCallback(async () => {
    try {
      const [cur, req] = await Promise.all([api("/driver/current"), api("/driver/requests")]);
      setCurrent(cur);
      setRequests(req);
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    loadMe();
    loadRides();
    const timer = setInterval(loadRides, 5000);
    return () => {
      clearInterval(timer);
      clearInterval(simRef.current);
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [loadMe, loadRides]);
  useEffect(() => { if (tab === "earnings") api("/driver/trips").then(setHistory).catch((e) => setError(e.message)); }, [tab]);

  const act = async (path, body) => {
    setError("");
    try { await api(path, { method: "POST", body }); await Promise.all([loadRides(), loadMe()]); }
    catch (err) { setError(err.message); }
  };

  const stopSim = () => { clearInterval(simRef.current); simRef.current = null; setSimulating(false); };
  // Demo: moves the car in a straight line towards a target and posts each position to the server.
  const simulate = (to) => {
    stopSim();
    const start = { lat: me?.lat ?? to.lat + 0.04, lng: me?.lng ?? to.lng + 0.04 };
    let i = 0;
    const steps = 20;
    setSimulating(true);
    simRef.current = setInterval(async () => {
      i += 1;
      const lat = start.lat + (to.lat - start.lat) * (i / steps);
      const lng = start.lng + (to.lng - start.lng) * (i / steps);
      try { setMe(await api("/driver/location", { method: "POST", body: { lat, lng } })); } catch { stopSim(); }
      if (i >= steps) stopSim();
    }, 2000);
  };

  const toggleGps = () => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      setGps(false);
      return;
    }
    if (!navigator.geolocation) return setError("GPS is not available in this browser");
    let last = 0;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() - last < 4000) return;
        last = Date.now();
        api("/driver/location", { method: "POST", body: { lat: pos.coords.latitude, lng: pos.coords.longitude } }).then(setMe).catch(() => {});
      },
      () => setError("Allow location access to share your position"),
      { enableHighAccuracy: true },
    );
    setGps(true);
  };

  if (!me) return <p className="center muted">{error || "Loading..."}</p>;
  const approved = me.kyc_status === "approved";
  const ride = current;

  return (
    <>
      <div className="row-between">
        <div>
          <h1>Driver dashboard</h1>
          <p className="muted">{me.full_name} - rated {me.rating} - {me.total_trips} trips - documents <span className={`badge ${me.kyc_status}`}>{me.kyc_status}</span></p>
        </div>
        <button className={`btn ${me.is_online ? "btn-danger" : "btn-success"}`} onClick={() => act("/driver/online", { online: !me.is_online })}>
          {me.is_online ? "Go offline" : "Go online"}
        </button>
      </div>
      {!approved && <div className="warn-box">You can go online after your profile, vehicle and all documents are submitted and approved by the admin.</div>}
      {error && <p className="error">{error}</p>}

      <div className="tabs" role="tablist">
        {[["rides", "Rides"], ["profile", "Profile and vehicle"], ["documents", "Documents"], ["earnings", "Earnings"]].map(([k, text]) => (
          <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{text}</button>
        ))}
      </div>

      {tab === "rides" && (
        <>
          <div className="panel row-between">
            <div>
              <strong>Live location</strong>
              <p className="muted small">{me.lat != null ? `${me.lat.toFixed(4)}, ${me.lng.toFixed(4)}` : "Not shared yet"}</p>
            </div>
            <button className="btn btn-secondary" onClick={toggleGps}>{gps ? "Stop sharing GPS" : "Share my GPS"}</button>
          </div>

          {ride && (
            <div className="panel">
              <div className="row-between"><h3>Current ride</h3><span className={`badge ${ride.status}`}>{label(ride.status)}</span></div>
              <p><strong>{ride.pickup_name}</strong> to <strong>{ride.drop_name}</strong></p>
              <p className="muted small">{when(ride.pickup_time)} - {ride.distance_km} km - {ride.passengers} passenger(s), {ride.luggage} bag(s) - {inr(ride.fare)}</p>
              <p className="small">Customer: {ride.customer_name} {ride.customer_phone && <a href={`tel:${ride.customer_phone}`}>{ride.customer_phone}</a>}{ride.flight_or_train && ` - ${ride.flight_or_train}`}</p>
              {ride.notes && <p className="small muted">Note: {ride.notes}</p>}
              <LiveMap
                pickup={{ lat: ride.pickup_lat, lng: ride.pickup_lng, name: ride.pickup_name }}
                drop={{ lat: ride.drop_lat, lng: ride.drop_lng, name: ride.drop_name }}
                driver={me} height={300}
              />
              <div className="quick">
                {ride.status === "accepted" && (
                  <>
                    <button className="btn btn-secondary" disabled={simulating} onClick={() => simulate({ lat: ride.pickup_lat, lng: ride.pickup_lng })}>{simulating ? "Driving..." : "Drive to pickup (demo)"}</button>
                    <button className="btn btn-primary" onClick={() => act(`/driver/transfers/${ride.id}/arrived`)}>I have arrived</button>
                  </>
                )}
                {ride.status === "arrived" && (
                  <>
                    <input style={{ maxWidth: 140 }} inputMode="numeric" maxLength={4} placeholder="Ride OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
                    <button className="btn btn-primary" disabled={otp.length !== 4} onClick={() => act(`/driver/transfers/${ride.id}/start`, { otp })}>Start trip</button>
                  </>
                )}
                {ride.status === "in_trip" && (
                  <>
                    <button className="btn btn-secondary" disabled={simulating} onClick={() => simulate({ lat: ride.drop_lat, lng: ride.drop_lng })}>{simulating ? "Driving..." : "Drive to drop (demo)"}</button>
                    <button className="btn btn-success" onClick={() => { stopSim(); act(`/driver/transfers/${ride.id}/complete`); }}>Complete trip</button>
                  </>
                )}
              </div>
            </div>
          )}

          <h3>Open ride requests</h3>
          {!me.is_online && <p className="muted">Go online to see requests for your vehicle type.</p>}
          {me.is_online && requests.length === 0 && <p className="muted">No requests right now. New ones appear here automatically.</p>}
          <div className="list">
            {requests.map((r) => (
              <div className="item" key={r.id}>
                <div className="grow">
                  <strong>{r.pickup_name} to {r.drop_name}</strong>
                  <p className="muted small">{when(r.pickup_time)} - {r.distance_km} km - {r.passengers} passenger(s){r.pickup_distance_km != null ? ` - ${r.pickup_distance_km} km from you` : ""}</p>
                </div>
                <strong>{inr(r.fare)}</strong>
                <button className="btn btn-primary btn-sm" disabled={!!ride} onClick={() => act(`/driver/transfers/${r.id}/accept`)}>Accept</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "profile" && <ProfileForms me={me} onSaved={setMe} />}
      {tab === "documents" && <DocsManager groups={DRIVER_GROUPS} />}
      {tab === "earnings" && (
        <>
          <div className="stats">
            <div className="stat"><b>{history.count}</b>Completed trips</div>
            <div className="stat"><b>{inr(history.earnings)}</b>Your earnings (80% of fares)</div>
          </div>
          <div className="list">
            {history.trips.map((t) => (
              <div className="item" key={t.id}>
                <div className="grow"><strong>{t.pickup_name} to {t.drop_name}</strong><p className="muted small">{day(t.created_at)} - {t.distance_km} km - {t.customer_name}</p></div>
                <strong>{inr(t.fare)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
