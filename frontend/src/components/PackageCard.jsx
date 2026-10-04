import { Link } from "react-router-dom";
import { inr } from "../format";
import SafeImg from "./SafeImg";

export default function PackageCard({ pkg }) {
  return (
    <article className="card">
      <Link to={`/trips/${pkg.id}`} className="card-media" aria-label={`View ${pkg.title}`}>
        <SafeImg className="card-img" src={pkg.image_url} alt={pkg.title} />
        <div className="card-badges">
          <span className="tag">{pkg.category}</span>
          {pkg.is_international && <span className="tag tag-gold">International</span>}
        </div>
      </Link>
      <div className="card-body">
        <p className="eyebrow">{pkg.destination}</p>
        <h3>{pkg.title}</h3>
        <p className="muted small">{pkg.country} - {pkg.duration_days} days - {pkg.seats} seats left</p>
        <div className="card-footer">
          <span className="price"><small>From</small> {inr(pkg.price)}<small> / person</small></span>
          <Link to={`/trips/${pkg.id}`} className="btn btn-outline btn-sm">Explore</Link>
        </div>
      </div>
    </article>
  );
}
