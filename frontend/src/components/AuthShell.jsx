import { useEffect, useState } from "react";
import { resolveImage } from "../images";

// Centered card on a photo backdrop, shared by log in, sign up and reset password.
export default function AuthShell({ title, subtitle, children }) {
  const [art, setArt] = useState("");
  useEffect(() => { resolveImage("hero:auth").then((u) => u && setArt(u)); }, []);
  return (
    <div className="auth-page" style={art ? { backgroundImage: `url(${art})` } : undefined}>
      <div className="auth-card">
        <div className="auth-badge" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 26 26">
            <path d="M13 1.5 24.5 13 13 24.5 1.5 13Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13 7.5 18.5 13 13 18.5 7.5 13Z" fill="currentColor" />
          </svg>
        </div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
