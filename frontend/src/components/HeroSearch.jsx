import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";

const TABS = [["hotels", "Hotels", "bed"], ["trips", "Trips", "globe"], ["rides", "Airport rides", "plane"]];

// The search bar on the home page: hotels and rides open their own pages, trips filter the list below.
export default function HeroSearch({ onTrips }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("hotels");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("");
  const [region, setRegion] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (tab === "hotels") {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (sort) params.set("sort", sort);
      navigate(`/hotels?${params}`);
    } else if (tab === "trips") {
      onTrips({ q, region });
    } else {
      navigate("/transfers");
    }
  };

  return (
    <form className="booking-bar" onSubmit={submit}>
      <div className="bb-tabs" role="tablist">
        {TABS.map(([key, text, icon]) => (
          <button type="button" role="tab" aria-selected={tab === key} key={key} className={`bb-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            <Icon name={icon} size={16} /> {text}
          </button>
        ))}
      </div>
      <div className="bb-fields">
        {tab !== "rides" ? (
          <>
            <label className="bb-field">
              <span>{tab === "hotels" ? "City, country or hotel" : "Destination or trip"}</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "hotels" ? "Dubai, Paris, Jaipur..." : "Bali, Rajasthan, Umrah..."} />
            </label>
            {tab === "hotels" ? (
              <label className="bb-field">
                <span>Sort by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="">Recommended</option>
                  <option value="rating">Top rated</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
              </label>
            ) : (
              <label className="bb-field">
                <span>Where</span>
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="">India and world</option>
                  <option value="domestic">India only</option>
                  <option value="international">International</option>
                </select>
              </label>
            )}
          </>
        ) : (
          <p className="bb-note">
            Choose your airport or railway station and your hotel. A verified driver meets you, and you follow the car live on the map.
          </p>
        )}
        <button className="btn btn-primary bb-go">
          {tab === "rides" ? "Book a ride" : "Search"} <Icon name="arrow" size={16} />
        </button>
      </div>
    </form>
  );
}
