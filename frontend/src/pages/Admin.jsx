import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import DocImage from "../components/DocImage";
import { inr, label } from "../format";

function Kyc() {
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");
  const load = useCallback(() => api("/kyc/admin/pending").then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const review = async (id, status) => {
    setError("");
    try { await api(`/kyc/admin/documents/${id}/review`, { method: "POST", body: { status, note: notes[id] || "" } }); load(); }
    catch (err) { setError(err.message); }
  };

  return (
    <>
      <h3>Documents waiting for review ({items.length})</h3>
      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="muted">Nothing to review. New uploads appear here.</p>}
      {items.map((d) => (
        <div className="panel" key={d.id}>
          <div className="row-between">
            <div>
              <strong>{label(d.doc_type)}</strong> {d.number_last4 && <span className="muted">ending {d.number_last4}</span>}
              <p className="muted small">{d.user_name} ({d.user_role}) - {d.user_email || d.user_phone}</p>
            </div>
          </div>
          <DocImage id={d.id} />
          <label style={{ marginTop: 10 }}>Note to the user (optional)
            <input value={notes[d.id] || ""} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} placeholder="Photo is blurry, please re-upload" />
          </label>
          <div className="quick">
            <button className="btn btn-success btn-sm" onClick={() => review(d.id, "approved")}>Approve</button>
            <button className="btn btn-danger btn-sm" onClick={() => review(d.id, "rejected")}>Reject</button>
          </div>
        </div>
      ))}
    </>
  );
}

const Table = ({ head, rows }) => (
  <div className="table-wrap panel">
    <table>
      <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
    {rows.length === 0 && <p className="muted">Nothing here yet.</p>}
  </div>
);

export default function Admin() {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loaders = { overview: () => api("/admin/stats").then(setStats), drivers: () => api("/admin/drivers").then(setDrivers), users: () => api("/admin/users").then(setUsers), activity: () => api("/admin/activity").then(setActivity) };
    loaders[tab]?.().catch((e) => setError(e.message));
  }, [tab]);

  const badge = (s) => <span className={`badge ${s}`}>{label(s)}</span>;

  return (
    <>
      <h1>Admin dashboard</h1>
      {error && <p className="error">{error}</p>}
      <div className="tabs" role="tablist">
        {[["overview", "Overview"], ["kyc", "Document review"], ["drivers", "Drivers"], ["users", "Users"], ["activity", "Bookings and rides"]].map(([k, text]) => (
          <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{text}</button>
        ))}
      </div>

      {tab === "overview" && stats && (
        <>
          <div className="stats">
            {[["Customers", stats.customers], ["Drivers", stats.drivers], ["Drivers online", stats.drivers_online], ["Documents to review", stats.documents_pending], ["Trip bookings", stats.trip_bookings], ["Hotel stays", stats.hotel_stays], ["Rides booked", stats.transfers]].map(([t, v]) => (
              <div className="stat" key={t}><b>{v}</b>{t}</div>
            ))}
          </div>
          <div className="stats">
            <div className="stat"><b>{inr(stats.revenue.trips)}</b>Trip revenue</div>
            <div className="stat"><b>{inr(stats.revenue.stays)}</b>Hotel revenue</div>
            <div className="stat"><b>{inr(stats.revenue.transfers)}</b>Ride revenue</div>
          </div>
        </>
      )}
      {tab === "kyc" && <Kyc />}
      {tab === "drivers" && (
        <Table
          head={["Driver", "Contact", "Aadhaar / PAN / Licence", "Vehicle", "Documents", "Status"]}
          rows={drivers.map((d) => [
            <><strong>{d.name}</strong><br />{d.city}</>,
            <>{d.phone || "-"}<br />{d.email}</>,
            `${d.aadhaar_last4 || "-"} / ${d.pan_last4 || "-"} / ${d.licence_last4 || "-"}`,
            d.vehicle || "-",
            d.documents.map((x) => `${label(x.type)}: ${x.status}`).join(", ") || "none",
            <>{badge(d.kyc_status)} {d.is_online && badge("online")}<br />{d.total_trips} trips, rated {d.rating}</>,
          ])}
        />
      )}
      {tab === "users" && (
        <Table head={["Name", "Email", "Mobile", "Role"]} rows={users.map((u) => [u.name, u.email || "-", u.phone || "-", badge(u.role)])} />
      )}
      {tab === "activity" && activity && (
        <>
          <h3>Rides</h3>
          <Table head={["#", "Customer", "Driver", "Route", "Fare", "Status"]} rows={activity.transfers.map((t) => [t.id, t.customer, t.driver || "unassigned", t.route, inr(t.fare), badge(t.status)])} />
          <h3>Hotel stays</h3>
          <Table head={["#", "Customer", "Hotel", "Nights", "Total", "Status"]} rows={activity.stays.map((s) => [s.id, s.customer, s.hotel, s.nights, inr(s.total), badge(s.status)])} />
          <h3>Trip bookings</h3>
          <Table head={["#", "Customer", "Package", "Total", "Status"]} rows={activity.trips.map((b) => [b.id, b.customer, b.package, inr(b.total), badge(b.status)])} />
        </>
      )}
    </>
  );
}
