const FEATURES = [
  ["Trip packages", "Curated holidays across India and the world, including Umrah to Makkah and Madinah, with clear starting prices and offers."],
  ["Five-star hotels", "Browse hotels with photo galleries, choose a room type, add breakfast, spa or airport pickup, and book your stay."],
  ["Airport and station rides", "Book a car from an airport or railway station to your hotel and follow your driver live on the map."],
  ["Verified drivers", "Every driver submits identity and vehicle documents and is approved by an administrator before taking rides."],
  ["Traveller verification", "Upload a passport and visa for international trips, or Aadhaar, PAN or a driving licence for trips within India."],
  ["Secure sign-in", "Sign in with email and password or a mobile OTP. Customers, drivers and administrators each have their own login."],
];

const ROLES = [
  ["Customer", "Searches trips and hotels, books stays and rides, manages passenger details and tracks bookings."],
  ["Driver", "Completes onboarding, shares live location, accepts ride requests and views earnings."],
  ["Admin", "Has full access: reviews documents, approves drivers, monitors bookings and users, and can use every traveller feature."],
];

export default function About() {
  return (
    <div className="info-page stack">
      <h1>About TripNest</h1>
      <div className="panel">
        <p>TripNest is a travel management and booking platform that brings holiday packages, five-star hotels and airport or railway station pickups into one place. Travellers plan and pay in a single flow, and drivers and administrators have their own tools to keep every journey safe and organised.</p>
        <p className="muted">TripNest was designed, developed and is owned by <strong>MD AFFAN ANWAR</strong>.</p>
      </div>

      <h2>What you can do</h2>
      <div className="about-grid">
        {FEATURES.map(([title, text]) => (
          <div className="panel" key={title}>
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </div>

      <h2>Who uses TripNest</h2>
      <div className="panel">
        <ul className="about-roles">
          {ROLES.map(([role, text]) => <li key={role}><strong>{role}.</strong> {text}</li>)}
        </ul>
      </div>

      <h2>Built with</h2>
      <div className="panel">
        <p className="muted">React and Vite on the frontend, with HTML5, CSS3 and JavaScript. Python and FastAPI on the backend, with PostgreSQL for data. Authentication uses signed tokens and hashed passwords, and live tracking uses OpenStreetMap maps.</p>
      </div>

      <div className="panel">
        <h3>Please note</h3>
        <p className="muted">Prices are indicative and confirmed at booking. Hotel listings are sample data. Document checks are an upload and manual review process, and payment checkout is simulated until a payment gateway is connected.</p>
      </div>
    </div>
  );
}
