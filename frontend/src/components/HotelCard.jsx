import { Link } from "react-router-dom";
import { inr, stars } from "../format";
import Icon from "./Icon";
import SafeImg from "./SafeImg";

export default function HotelCard({ hotel }) {
  return (
    <article className="card">
      <Link to={`/hotels/${hotel.id}`} className="card-media" aria-label={`View ${hotel.name}`}>
        <SafeImg className="card-img" src={hotel.images[0]} alt={hotel.name} />
        <span className="rating-pill"><Icon name="star" size={13} /> {hotel.rating}</span>
      </Link>
      <div className="card-body">
        <span className="stars" aria-label={`${hotel.star_rating} star hotel`}>{stars(hotel.star_rating)}</span>
        <h3>{hotel.name}</h3>
        <p className="muted small">{hotel.city}, {hotel.country} - {hotel.reviews_count.toLocaleString("en-IN")} reviews</p>
        <p className="small">{hotel.amenities.slice(0, 3).join("  /  ")}</p>
        <p className="muted small">{hotel.airport_distance_km} km from {hotel.nearest_airport}</p>
        <div className="card-footer">
          <span className="price"><small>From</small> {inr(hotel.from_price)}<small> / night</small></span>
          <Link to={`/hotels/${hotel.id}`} className="btn btn-outline btn-sm">View rooms</Link>
        </div>
      </div>
    </article>
  );
}
