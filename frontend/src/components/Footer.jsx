import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-simple">
        <Link to="/" className="footer-logo">Trip<b>Nest</b></Link>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
        </nav>
        <p className="footer-copy">&copy; {new Date().getFullYear()} TripNest. All rights reserved.</p>
      </div>
    </footer>
  );
}
