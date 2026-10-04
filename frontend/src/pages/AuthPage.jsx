import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { homeFor, useAuth } from "../AuthContext";
import AuthShell from "../components/AuthShell";
import PasswordInput from "../components/PasswordInput";

function PasswordLogin({ onDone }) {
  const { signIn } = useAuth();
  const [f, setF] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try { onDone(await signIn("/auth/login", f)); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      <label>Email<input type="email" value={f.email} onChange={set("email")} required autoComplete="email" /></label>
      <label>Password<PasswordInput value={f.password} onChange={set("password")} autoComplete="current-password" /></label>
      <p className="auth-forgot"><Link to="/forgot-password">Forgot password?</Link></p>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary full auth-submit" disabled={busy}>{busy ? "Please wait..." : "Log in"}</button>
    </form>
  );
}

function OtpLogin({ onDone }) {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e?.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await api("/auth/otp/send", { method: "POST", body: { phone } });
      setSent(true);
      setDevOtp(res.dev_otp || "");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const verify = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try { onDone(await signIn("/auth/otp/verify", { phone, code, name: name || null })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (!sent) {
    return (
      <form onSubmit={send}>
        <p className="muted small">We will send a one-time code to your mobile number. New number? We create a traveller account for you.</p>
        <label>Mobile number<input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" required autoComplete="tel" /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary full auth-submit" disabled={busy}>{busy ? "Sending..." : "Send OTP"}</button>
      </form>
    );
  }
  return (
    <form onSubmit={verify}>
      <p>Enter the 6-digit code sent to <strong>{phone}</strong>.</p>
      {devOtp && <div className="warn-box">Dev mode: no SMS is sent. Your OTP is <strong>{devOtp}</strong> (also printed in the backend terminal).</div>}
      <label>OTP<input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required /></label>
      <label>Your name (new accounts)<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary full auth-submit" disabled={busy || code.length !== 6}>{busy ? "Checking..." : "Verify and continue"}</button>
      <p className="center small" style={{ marginTop: 10 }}>
        <button type="button" className="link-btn" onClick={send}>Resend OTP</button> - <button type="button" className="link-btn" onClick={() => setSent(false)}>Change number</button>
      </p>
    </form>
  );
}

function SignUpForm({ onDone, initialRole }) {
  const { signIn } = useAuth();
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "", confirm: "", address: "", admin_code: "", role: initialRole });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (f.password !== f.confirm) { setError("Passwords do not match"); return; }
    setError(""); setBusy(true);
    try {
      const body = { name: f.name, email: f.email, password: f.password, role: f.role, phone: f.phone || undefined, address: f.address || undefined };
      if (f.role === "admin") body.admin_code = f.admin_code;
      onDone(await signIn("/auth/register", body));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      <div className="auth-grid">
        <label>Full name<input value={f.name} onChange={set("name")} required minLength={2} autoComplete="name" /></label>
        <label>Mobile (10 digits)<input inputMode="tel" value={f.phone} onChange={set("phone")} required={f.role === "driver"} autoComplete="tel" /></label>
      </div>
      <label>Email<input type="email" value={f.email} onChange={set("email")} required autoComplete="email" /></label>
      <div className="auth-grid">
        <label>Password<PasswordInput value={f.password} onChange={set("password")} autoComplete="new-password" /></label>
        <label>Confirm password<PasswordInput value={f.confirm} onChange={set("confirm")} autoComplete="new-password" /></label>
      </div>
      {f.role === "customer" && <label>Address (optional)<textarea value={f.address} onChange={set("address")} rows={2} autoComplete="street-address" /></label>}
      {f.role === "admin" && <label>Admin access code<input type="password" value={f.admin_code} onChange={set("admin_code")} required autoComplete="off" /></label>}
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary full auth-submit" disabled={busy}>{busy ? "Please wait..." : "Sign up"}</button>
    </form>
  );
}

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Drivers and admins reach sign-up through ?role=driver or ?role=admin; everyone else is a customer.
  const startRole = ["driver", "admin"].includes(params.get("role")) ? params.get("role") : "customer";
  const [method, setMethod] = useState("password");
  const login = mode === "login";
  // One login for everyone: the account's own role decides where it lands.
  const done = (user) => navigate(homeFor(user));

  if (!login) {
    const titles = { customer: "Create account", driver: "Create driver account", admin: "Create admin account" };
    return (
      <AuthShell title={titles[startRole]} subtitle="Join TripNest and start planning your journey">
        <SignUpForm onDone={done} initialRole={startRole} />
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
        {startRole === "customer" && <p className="auth-switch" style={{ marginTop: 6 }}>Want to drive with TripNest? <Link to="/register?role=driver">Sign up as a driver</Link></p>}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue your journey">
      <div className="seg" role="tablist" aria-label="Login method">
        <button type="button" role="tab" aria-selected={method === "password"} className={method === "password" ? "active" : ""} onClick={() => setMethod("password")}>Password</button>
        <button type="button" role="tab" aria-selected={method === "otp"} className={method === "otp" ? "active" : ""} onClick={() => setMethod("otp")}>Mobile OTP</button>
      </div>
      {method === "otp" ? <OtpLogin onDone={done} /> : <PasswordLogin onDone={done} />}
      <p className="auth-switch">New to TripNest? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}
