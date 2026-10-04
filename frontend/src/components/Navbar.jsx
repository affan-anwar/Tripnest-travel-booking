import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import Icon from "./Icon";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { pref, setPref } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = pref === "dark" || (pref === "system" && systemDark);
  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="logo" aria-label="TripNest home">
          <svg className="logo-mark" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <path d="M13 1.5 24.5 13 13 24.5 1.5 13Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M13 7.5 18.5 13 13 18.5 7.5 13Z" fill="currentColor" />
          </svg>
          <span>Trip<b>Nest</b></span>
        </Link>
        <nav className={`nav-links ${open ? "open" : ""}`} aria-label="Main" onClick={() => setOpen(false)}>
          {(!user || user.role === "customer" || user.role === "admin") && (
            <>
              <NavLink to="/" end>Trips</NavLink>
              <NavLink to="/hotels">Hotels</NavLink>
              <NavLink to="/transfers">Airport rides</NavLink>
            </>
          )}
          {(user?.role === "customer" || user?.role === "admin") && <NavLink to="/my-trips">My bookings</NavLink>}
          {user?.role === "driver" && <NavLink to="/driver">Driver dashboard</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
          <NavLink to="/about">About</NavLink>
        </nav>
        <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label="Open menu" aria-expanded={open}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <div className="nav-actions">
          <button className="icon-btn" onClick={() => setPref(dark ? "light" : "dark")} aria-label="Switch light or dark mode" title={`Theme: ${pref}`}>
            <Icon name={dark ? "sun" : "moon"} size={18} />
          </button>
          {user ? (
            <>
              <Link to="/account" className="avatar" title="My account">{user.name.trim().charAt(0).toUpperCase()}</Link>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-login">Log in</NavLink>
              <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
