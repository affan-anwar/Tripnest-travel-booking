import { useState } from "react";

// Password box with a Show / Hide button.
export default function PasswordInput({ value, onChange, autoComplete, minLength = 6 }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input type={show ? "text" : "password"} value={value} onChange={onChange} required minLength={minLength} maxLength={72} autoComplete={autoComplete} />
      <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button>
    </div>
  );
}
