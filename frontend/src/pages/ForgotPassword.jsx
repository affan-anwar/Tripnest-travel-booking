import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import AuthShell from "../components/AuthShell";
import PasswordInput from "../components/PasswordInput";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [devCode, setDevCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const requestCode = async (e) => {
    e?.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await api("/auth/forgot-password", { method: "POST", body: { email } });
      setDevCode(res.dev_code || "");
      setMessage(res.message);
      setStep(2);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: { email, code, new_password: password } });
      setStep(3);
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Reset password" subtitle="Get a code and choose a new password">
      <div>
        {step === 1 && (
          <form onSubmit={requestCode}>
            <p className="muted">Enter the email you signed up with. This works for customer, driver and admin accounts.</p>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary full auth-submit" disabled={busy}>{busy ? "Sending..." : "Send reset code"}</button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={reset}>
            <p className="muted">{message}</p>
            {devCode && <div className="warn-box">Dev mode: no email is sent. Your reset code is <strong>{devCode}</strong> (also printed in the backend terminal).</div>}
            <label>Reset code<input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required /></label>
            <label>New password<PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary full auth-submit" disabled={busy || code.length !== 6}>{busy ? "Saving..." : "Update password"}</button>
            <p className="center small" style={{ marginTop: 10 }}><button type="button" className="link-btn" onClick={requestCode}>Send a new code</button></p>
          </form>
        )}
        {step === 3 && <div className="info"><strong>Password updated.</strong> Taking you to the login page...</div>}
        <p className="auth-switch"><Link to="/login">Back to log in</Link></p>
      </div>
    </AuthShell>
  );
}
