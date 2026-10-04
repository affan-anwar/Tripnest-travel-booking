import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import DocsManager, { CUSTOMER_GROUPS } from "../components/DocsManager";
import { useTheme } from "../ThemeContext";

function Profile() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({
    name: user.name, phone: user.phone || "", address: user.address || "", nationality: user.nationality || "",
    dob: user.dob || "", emergency_name: user.emergency_name || "", emergency_phone: user.emergency_phone || "",
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setMsg(""); setError("");
    try {
      setUser(await api("/me/profile", { method: "PUT", body: { ...f, dob: f.dob || null } }));
      setMsg("Profile saved");
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="panel" onSubmit={save}>
      <h3>Your profile</h3>
      <p className="muted small">{user.email || "No email on this account"} - {user.role}</p>
      <div className="form-grid">
        <label>Full name<input value={f.name} onChange={set("name")} required minLength={2} /></label>
        <label>Mobile number<input value={f.phone} onChange={set("phone")} placeholder="+91 98765 43210" /></label>
        <label>Date of birth<input type="date" value={f.dob} onChange={set("dob")} /></label>
        <label>Nationality<input value={f.nationality} onChange={set("nationality")} /></label>
        <label>Address<input value={f.address} onChange={set("address")} /></label>
        <label>Emergency contact name<input value={f.emergency_name} onChange={set("emergency_name")} /></label>
        <label>Emergency contact number<input value={f.emergency_phone} onChange={set("emergency_phone")} /></label>
      </div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}
      <button className="btn btn-primary">Save profile</button>
    </form>
  );
}

function Passengers() {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ full_name: "", age: "", gender: "male", nationality: "", id_type: "", id_number: "" });
  const [error, setError] = useState("");
  const load = () => api("/me/passengers").then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/me/passengers", { method: "POST", body: { ...f, age: Number(f.age) } });
      setF({ full_name: "", age: "", gender: "male", nationality: "", id_type: "", id_number: "" });
      load();
    } catch (err) { setError(err.message); }
  };
  const remove = async (id) => { await api(`/me/passengers/${id}`, { method: "DELETE" }); load(); };

  return (
    <>
      <form className="panel" onSubmit={add}>
        <h3>Add a saved passenger</h3>
        <p className="muted small">Saved passengers can be filled into any booking with one tap.</p>
        <div className="form-grid">
          <label>Full name<input value={f.full_name} onChange={set("full_name")} required minLength={2} /></label>
          <label>Age<input type="number" min="0" max="120" value={f.age} onChange={set("age")} required /></label>
          <label>Gender<select value={f.gender} onChange={set("gender")}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
          <label>Nationality<input value={f.nationality} onChange={set("nationality")} /></label>
          <label>ID type
            <select value={f.id_type} onChange={set("id_type")}>
              <option value="">None</option><option value="aadhaar">Aadhaar</option><option value="pan">PAN</option>
              <option value="passport">Passport</option><option value="driving_licence">Driving licence</option>
            </select>
          </label>
          {f.id_type && <label>ID number (only last 4 digits are kept)<input value={f.id_number} onChange={set("id_number")} required /></label>}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary">Save passenger</button>
      </form>
      <div className="list">
        {list.length === 0 && <p className="muted">No saved passengers yet.</p>}
        {list.map((p) => (
          <div className="item" key={p.id}>
            <div className="grow"><strong>{p.full_name}</strong><p className="muted small">{p.age} yrs - {p.gender}{p.nationality ? ` - ${p.nationality}` : ""}{p.id_type ? ` - ${p.id_type} ending ${p.id_last4}` : ""}</p></div>
            <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>Remove</button>
          </div>
        ))}
      </div>
    </>
  );
}

function Settings() {
  const { user, setUser } = useAuth();
  const { setPref } = useTheme();
  const [f, setF] = useState({ theme: user.theme, currency: user.currency, notify_email: user.notify_email, notify_sms: user.notify_sms });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setMsg(""); setError("");
    try {
      setUser(await api("/me/settings", { method: "PUT", body: f }));
      setPref(f.theme);
      setMsg("Settings saved");
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="panel" onSubmit={save}>
      <h3>Settings</h3>
      <div className="form-grid">
        <label>Appearance
          <select value={f.theme} onChange={(e) => { setF({ ...f, theme: e.target.value }); setPref(e.target.value); }}>
            <option value="system">Match my device</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </label>
        <label>Preferred currency
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
            {["INR", "USD", "EUR", "GBP", "AED", "SAR", "SGD", "AUD", "JPY"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label className="check"><input type="checkbox" checked={f.notify_email} onChange={(e) => setF({ ...f, notify_email: e.target.checked })} />Email updates about my bookings</label>
      <label className="check"><input type="checkbox" checked={f.notify_sms} onChange={(e) => setF({ ...f, notify_sms: e.target.checked })} />SMS updates about my rides</label>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}
      <button className="btn btn-primary">Save settings</button>
    </form>
  );
}

export default function Account() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const customer = user.role === "customer";
  const tabs = [["profile", "Profile"], ...(customer ? [["passengers", "Passengers"], ["verification", "Verification"]] : []), ["settings", "Settings"]];
  const tab = tabs.some(([k]) => k === params.get("tab")) ? params.get("tab") : "profile";

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <h1>My account</h1>
      <div className="tabs" role="tablist">
        {tabs.map(([k, text]) => <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setParams({ tab: k })}>{text}</button>)}
      </div>
      {tab === "profile" && <Profile />}
      {tab === "passengers" && <Passengers />}
      {tab === "verification" && <DocsManager groups={CUSTOMER_GROUPS} />}
      {tab === "settings" && <Settings />}
    </div>
  );
}
