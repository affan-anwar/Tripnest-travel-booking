import { useState } from "react";
import Icon from "../components/Icon";

// TripNest contact form on Formspree. VITE_CONTACT_FORM_URL in frontend/.env can override it.
const FORM_URL = import.meta.env.VITE_CONTACT_FORM_URL || "https://formspree.io/f/maenrgop";

function Page({ title, intro, children }) {
  return (
    <div className="info-page stack">
      <h1>{title}</h1>
      {intro && <p className="muted">{intro}</p>}
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Contact() {
  const [f, setF] = useState({ name: "", email: "", message: "" });
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      if (!FORM_URL) throw new Error("The contact form is not set up yet. Please email us directly.");
      const res = await fetch(FORM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok) throw new Error("The message could not be sent. Please try again in a moment.");
      setState("sent");
      setF({ name: "", email: "", message: "" });
    } catch (err) {
      setError(err.message || "The message could not be sent. Please try again in a moment.");
      setState("idle");
    }
  };

  return (
    <Page title="Contact us" intro="Questions, feedback or a problem with a booking? Reach out any time and we will reply as soon as we can.">
      <div className="contact-cards">
        <div className="panel contact-card">
          <h3><Icon name="mail" size={18} /> Email</h3>
          <a href="mailto:mdaffananwar2025@gmail.com">mdaffananwar2025@gmail.com</a>
        </div>
        <div className="panel contact-card">
          <h3><Icon name="phone" size={18} /> Phone</h3>
          <a href="tel:+918292864221">+91 82928 64221</a>
        </div>
        <div className="panel contact-card">
          <h3><Icon name="pin" size={18} /> Location</h3>
          <span className="muted">Bengaluru, India</span>
        </div>
      </div>

      <h2>Send a message</h2>
      {state === "sent" ? (
        <div className="info"><strong>Thank you.</strong> Your message has been sent and we will get back to you soon.</div>
      ) : (
        <form onSubmit={submit}>
          <label>Your name<input name="name" value={f.name} onChange={set("name")} required minLength={2} autoComplete="name" /></label>
          <label>Your email<input name="email" type="email" value={f.email} onChange={set("email")} required autoComplete="email" /></label>
          <label>Message<textarea name="message" value={f.message} onChange={set("message")} required minLength={10} rows={6} /></label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={state === "sending"}>{state === "sending" ? "Sending..." : "Send message"}</button>
          <p className="muted small" style={{ marginTop: 10 }}>Your message is delivered straight to our inbox.</p>
        </form>
      )}
    </Page>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy Policy" intro="We respect your privacy. This policy explains what information TripNest collects, why we collect it and how we protect it.">
      <Section title="Information we collect">
        <p>We collect the details you give us when you create an account and book: your name, email address and mobile number, passenger details, and booking history. Drivers also provide vehicle details. To verify identity, we collect the documents you upload, such as a passport, visa, Aadhaar, PAN, driving licence and a selfie.</p>
      </Section>
      <Section title="How we use your information">
        <p>We use your information to create and manage your account, confirm bookings, verify travellers and drivers, arrange pickups, show your driver's live location during a ride, and respond to your questions. We do not sell your personal information.</p>
      </Section>
      <Section title="Identity documents">
        <p>Uploaded documents are used only for verification and are visible only to you and authorised administrators. Of each ID number, only the last four characters are stored. Aadhaar, PAN and licence numbers are never displayed in full.</p>
      </Section>
      <Section title="Location data">
        <p>A driver's location is shared only while the driver is online, and a passenger can see it only for their own active ride.</p>
      </Section>
      <Section title="Security">
        <p>Passwords are stored as secure hashes, sign-in uses signed tokens that expire, and access to each area is limited by role. No method of storage is completely risk free, but we work to protect your data.</p>
      </Section>
      <Section title="Your choices">
        <p>You can update your profile and saved travellers in your account at any time. To ask for your data to be corrected or deleted, contact us using the details on the Contact page.</p>
      </Section>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of Service" intro="By using TripNest you agree to these terms. Please read them carefully.">
      <Section title="Using TripNest">
        <p>You must provide accurate information and keep your login details private. You are responsible for activity on your account and for carrying valid identity documents when you travel.</p>
      </Section>
      <Section title="Bookings and prices">
        <p>Prices shown are indicative starting prices and are confirmed at the time of booking. A booking is confirmed once payment is successful. Offer codes apply only as described on each offer and may be withdrawn at any time.</p>
      </Section>
      <Section title="Cancellations">
        <p>You can cancel a trip, hotel stay or ride from My bookings before it begins. Refunds depend on the status of the booking at the time of cancellation.</p>
      </Section>
      <Section title="Verification">
        <p>International trips require a passport and visa. Trips within India require Aadhaar, PAN or a driving licence. We may refuse a booking if the documents are missing, unclear or do not match the traveller.</p>
      </Section>
      <Section title="Drivers">
        <p>Drivers must hold a valid licence and vehicle registration, and may go online only after an administrator approves all required documents. Drivers must follow traffic laws and treat passengers with respect.</p>
      </Section>
      <Section title="Acceptable use">
        <p>You may not misuse the service, submit false documents, interfere with other users or attempt to gain access to areas you are not permitted to use. We may suspend accounts that break these terms.</p>
      </Section>
      <Section title="Limitation of service">
        <p>Hotel listings are sample data, and payment checkout is simulated until a payment gateway is connected. We make reasonable efforts to keep the service available but cannot guarantee it will always be uninterrupted.</p>
      </Section>
      <Section title="Changes to these terms">
        <p>We may update these terms from time to time. Continued use of TripNest means you accept the updated terms.</p>
      </Section>
    </Page>
  );
}
