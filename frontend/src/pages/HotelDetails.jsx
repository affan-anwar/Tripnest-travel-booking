import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import PassengerForm, { cleanPassengers } from "../components/PassengerForm";
import SafeImg from "../components/SafeImg";
import { inr, stars, tomorrow } from "../format";

export default function HotelDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hotel, setHotel] = useState(null);
  const [addons, setAddons] = useState([]);
  const [saved, setSaved] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [form, setForm] = useState({ check_in: tomorrow(1), check_out: tomorrow(3), rooms: 1, guests: 2, requests: "" });
  const [chosen, setChosen] = useState([]);
  const [guests, setGuests] = useState([]);
  const [code, setCode] = useState("");
  const [offer, setOffer] = useState(null);
  const [offerError, setOfferError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/hotels/${id}`).then((h) => { setHotel(h); setRoomId(h.rooms[0]?.id); }).catch((e) => setError(e.message));
    api("/hotels/addons").then(setAddons).catch(() => {});
  }, [id]);
  useEffect(() => {
    if (user?.role === "customer") api("/me/passengers").then(setSaved).catch(() => {});
  }, [user]);

  if (error && !hotel) return <p className="error center">{error}</p>;
  if (!hotel) return <p className="center muted">Loading...</p>;

  const room = hotel.rooms.find((r) => r.id === roomId);
  const nights = Math.max(0, Math.round((new Date(form.check_out) - new Date(form.check_in)) / 86400000));
  const roomsTotal = room ? Number(room.price_per_night) * Number(form.rooms) * nights : 0;
  const addonsTotal = addons.filter((a) => chosen.includes(a.code)).reduce((s, a) => s + a.price, 0);
  const base = roomsTotal + addonsTotal;
  const discount = offer ? offer.discount : 0;
  const guestCount = Math.max(1, Math.min(6, Number(form.guests) || 1));
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setOffer(null); };
  const toggle = (c) => { setChosen(chosen.includes(c) ? chosen.filter((x) => x !== c) : [...chosen, c]); setOffer(null); };

  const applyOffer = async () => {
    setOffer(null);
    setOfferError("");
    if (!code.trim() || base <= 0) return;
    try { setOffer(await api("/offers/check", { method: "POST", body: { code, kind: "stay", amount: base } })); }
    catch (err) { setOfferError(err.message); }
  };

  const book = async (e) => {
    e.preventDefault();
    if (!user) return navigate("/login");
    setBusy(true);
    setError("");
    try {
      await api("/hotels/stays", {
        method: "POST",
        body: {
          hotel_id: hotel.id, room_type_id: roomId, check_in: form.check_in, check_out: form.check_out,
          rooms: Number(form.rooms), guests: Number(form.guests), addons: chosen, special_requests: form.requests,
          guest_details: cleanPassengers(guests.slice(0, guestCount)), offer_code: offer ? offer.code : null,
        },
      });
      navigate("/my-trips?tab=stays");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="details">
      <div>
        <div className="gallery">
          <div className="big"><SafeImg src={hotel.images[0]} alt={hotel.name} /></div>
          {hotel.images.slice(1, 3).map((src, i) => <SafeImg key={src} src={src} alt={`${hotel.name} photo ${i + 2}`} />)}
        </div>
        <span className="stars">{stars(hotel.star_rating)}</span>
        <h1>{hotel.name}</h1>
        <p className="muted">{hotel.address} - rated {hotel.rating} from {hotel.reviews_count} reviews</p>
        <p>{hotel.description}</p>
        <div className="info">
          Check-in {hotel.check_in_time}, check-out {hotel.check_out_time}. {hotel.airport_distance_km} km from {hotel.nearest_airport}.{" "}
          <Link to={`/transfers?hotel=${hotel.id}`}>Book a ride to this hotel</Link>
        </div>

        <h3>Hotel facilities</h3>
        <ul className="amen">{hotel.amenities.map((a) => <li key={a}>{a}</li>)}</ul>

        <h3 style={{ marginTop: 18 }}>Choose your room</h3>
        {hotel.rooms.map((r) => (
          <div key={r.id} className={`room ${r.id === roomId ? "selected" : ""}`}>
            <SafeImg src={r.image_url} alt={r.name} />
            <div>
              <strong>{r.name}</strong>
              <p className="muted small">{r.bed_type} - {r.size_sqm} m² - up to {r.max_guests} guests</p>
              <p className="small">{r.features.join(", ")}</p>
              <span className="badge">{r.breakfast_included ? "Breakfast included" : "Room only"}</span>{" "}
              <span className="badge">{r.refundable ? "Free cancellation" : "Non-refundable"}</span>
            </div>
            <div className="center">
              <div className="price">{inr(r.price_per_night)}</div>
              <div className="muted small">per night</div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setRoomId(r.id); setOffer(null); }}>
                {r.id === roomId ? "Selected" : "Select"}
              </button>
            </div>
          </div>
        ))}
        <h3>Cancellation policy</h3>
        <p className="muted">{hotel.cancellation_policy}</p>
      </div>

      <form className="panel sticky" onSubmit={book}>
        <h3>Book your stay</h3>
        <div className="form-grid">
          <label>Check-in<input type="date" min={tomorrow(0)} value={form.check_in} onChange={set("check_in")} required /></label>
          <label>Check-out<input type="date" min={form.check_in} value={form.check_out} onChange={set("check_out")} required /></label>
          <label>Rooms<input type="number" min="1" max="5" value={form.rooms} onChange={set("rooms")} required /></label>
          <label>Guests<input type="number" min="1" max="20" value={form.guests} onChange={set("guests")} required /></label>
        </div>
        <p className="small"><strong>Guest details</strong></p>
        <PassengerForm count={guestCount} value={guests} onChange={setGuests} saved={saved} />
        <p className="small"><strong>Add-ons</strong></p>
        {addons.map((a) => (
          <label key={a.code} className="check">
            <input type="checkbox" checked={chosen.includes(a.code)} onChange={() => toggle(a.code)} />
            {a.label} ({inr(a.price)})
          </label>
        ))}
        <label>Special requests
          <textarea value={form.requests} onChange={(e) => setForm({ ...form, requests: e.target.value })} placeholder="High floor, early check-in, anniversary decoration..." maxLength={500} />
        </label>
        <label>Offer code
          <div style={{ display: "flex", gap: 8 }}>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="STAY12" />
            <button type="button" className="btn btn-secondary" onClick={applyOffer}>Apply</button>
          </div>
        </label>
        {offer && <p className="success small">{offer.code} applied: {offer.message}</p>}
        {offerError && <p className="error small">{offerError}</p>}
        <div className="lines">
          <div><span>{form.rooms} room x {nights} night(s)</span><span>{inr(roomsTotal)}</span></div>
          {addonsTotal > 0 && <div><span>Add-ons</span><span>{inr(addonsTotal)}</span></div>}
          {discount > 0 && <div className="save"><span>Offer discount</span><span>- {inr(discount)}</span></div>}
          <div className="total"><span>Total</span><span>{inr(base - discount)}</span></div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary full" disabled={busy || nights < 1}>{busy ? "Booking..." : user ? "Confirm stay" : "Log in to book"}</button>
      </form>
    </div>
  );
}
